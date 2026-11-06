import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';
import {
  autoConfirmarCompraEstacionServicio,
  extractedListoEstacionServicio,
  motivoCamposInsuficientesEstacionServicio,
  UMBRAL_CONFIANZA_AUTO_CONFIRM_EDS,
  type DepsAutoConfirmEstacion,
  type ExtractedEstacionServicio,
} from './autoConfirmarCompraEstacionServicio';

const HOY = new Date().toISOString().slice(0, 10);

function extractedEds(over: Partial<ExtractedEstacionServicio> = {}): ExtractedEstacionServicio {
  return {
    invoice_number: '00-12345',
    supplier_name: 'Estación de Servicio El Recreo',
    supplier_rif: 'J-12345678-9',
    date: HOY,
    total_amount: 1500,
    confidence_score: 80,
    items: [{ description: 'GASOLINA 91', quantity: 20, unit_price: 75, unit: 'L' }],
    ...over,
  };
}

function dbPendiente(over: Record<string, unknown> = {}) {
  const extracted = (over.extracted as ExtractedEstacionServicio | undefined) ?? extractedEds();
  return crearFakeSupabase({
    ci_facturas_canal_pendientes: [
      {
        id: 'pend-eds',
        estado: 'extraido',
        extracted,
        proyecto_id: 'obra-1',
        entidad_id: 'ent-1',
        ubicacion_destino_id: 'alm-1',
        chat_id: '200',
        ...over,
      },
    ],
    ci_telegram_estados: [
      {
        chat_id: '200',
        contexto: 'factura',
        proyecto_id: 'obra-1',
        pending_factura_id: 'pend-eds',
        metadata: {},
      },
    ],
    ci_proyectos: [{ id: 'obra-1', nombre: 'Obra Norte', customer_id: null, entidad_id: 'ent-1' }],
  }) as unknown as SupabaseClient;
}

function depsEspia(confirmarOk = true): {
  deps: DepsAutoConfirmEstacion;
  confirmarArgs: unknown[];
  confirmarLlamadas: number;
} {
  const confirmarArgs: unknown[] = [];
  let confirmarLlamadas = 0;
  const deps: DepsAutoConfirmEstacion = {
    confirmar: async (_sb, params) => {
      confirmarLlamadas += 1;
      confirmarArgs.push(params);
      if (!confirmarOk) throw new Error('tasa BCV no disponible');
      return { compraId: 'compra-1', purchaseInvoiceId: 'pi-1', yaExistia: false };
    },
    asegurarAlmacen: async () => 'alm-auto',
    obraSugerida: async () => null,
    buscarPropietario: async () => null,
    leerContextoTelegram: async () => ({ proyectoId: '', procuraId: null }),
  };
  return {
    deps,
    confirmarArgs,
    get confirmarLlamadas() {
      return confirmarLlamadas;
    },
  };
}

describe('extractedListoEstacionServicio', () => {
  it('asume VES y contado cuando el OCR no confirmó moneda ni pago', () => {
    const listo = extractedListoEstacionServicio(extractedEds({ moneda: null, condicion_pago: null }));
    assert.equal(listo.moneda, 'VES');
    assert.equal(listo.condicion_pago, 'contado');
  });

  it('respeta moneda y condición ya confirmadas por el comprador', () => {
    const listo = extractedListoEstacionServicio(
      extractedEds({ moneda: 'USD', condicion_pago: 'credito', dias_credito: 15 }),
    );
    assert.equal(listo.moneda, 'USD');
    assert.equal(listo.condicion_pago, 'credito');
  });
});

describe('motivoCamposInsuficientesEstacionServicio', () => {
  it('pide número, total y líneas', () => {
    assert.equal(
      motivoCamposInsuficientesEstacionServicio(extractedEds({ invoice_number: '' })),
      'Sin número de factura',
    );
    assert.equal(
      motivoCamposInsuficientesEstacionServicio(extractedEds({ total_amount: 0 })),
      'Sin total de factura',
    );
    assert.equal(
      motivoCamposInsuficientesEstacionServicio(extractedEds({ items: [] })),
      'Sin líneas con descripción',
    );
  });

  it('rechaza confianza OCR por debajo del umbral', () => {
    const motivo = motivoCamposInsuficientesEstacionServicio(
      extractedEds({ confidence_score: UMBRAL_CONFIANZA_AUTO_CONFIRM_EDS - 1 }),
    );
    assert.match(String(motivo), /Confianza OCR/);
  });

  it('deja pasar una EDS completa de hoy', () => {
    assert.equal(motivoCamposInsuficientesEstacionServicio(extractedEds()), null);
  });
});

describe('autoConfirmarCompraEstacionServicio', () => {
  it('happy path: EDS con obra y almacén llama al mismo Confirmar (VES + contado)', async () => {
    const espia = depsEspia();
    const r = await autoConfirmarCompraEstacionServicio(
      dbPendiente(),
      'pend-eds',
      extractedEds({ moneda: null, condicion_pago: null }),
      espia.deps,
    );
    assert.equal(r.aplicado, true);
    assert.equal(r.detectada, true);
    assert.equal(r.compraId, 'compra-1');
    assert.equal(espia.confirmarLlamadas, 1);
    const args = espia.confirmarArgs[0] as {
      pendingId: string;
      proyectoId: string;
      ubicacionDestinoId: string;
      imputacionEntidad?: boolean;
      extractedOverride?: { moneda?: string; condicion_pago?: string };
    };
    assert.equal(args.pendingId, 'pend-eds');
    assert.equal(args.proyectoId, 'obra-1');
    assert.equal(args.ubicacionDestinoId, 'alm-1');
    assert.equal(args.imputacionEntidad, false);
    assert.equal(args.extractedOverride?.moneda, 'VES');
    assert.equal(args.extractedOverride?.condicion_pago, 'contado');
  });

  it('skip: factura que no es estación de servicio no toca Confirmar', async () => {
    const ferreteria = extractedEds({
      supplier_name: 'Ferretería El Clavo',
      items: [{ description: 'Cabilla 3/8', quantity: 10, unit_price: 5 }],
    });
    const espia = depsEspia();
    const r = await autoConfirmarCompraEstacionServicio(
      dbPendiente({ extracted: ferreteria, supplier_name: ferreteria.supplier_name }),
      'pend-eds',
      ferreteria,
      espia.deps,
    );
    assert.equal(r.aplicado, false);
    assert.equal(r.detectada, false);
    assert.equal(espia.confirmarLlamadas, 0);
  });

  it('skip: EDS sin obra ni entidad queda extraída', async () => {
    const espia = depsEspia();
    const sb = dbPendiente({ proyecto_id: null, entidad_id: null, chat_id: null });
    const r = await autoConfirmarCompraEstacionServicio(
      sb,
      'pend-eds',
      extractedEds(),
      { ...espia.deps, obraSugerida: async () => null },
    );
    assert.equal(r.aplicado, false);
    assert.equal(r.detectada, true);
    assert.match(String(r.motivo), /Sin obra ni entidad/);
    assert.equal(espia.confirmarLlamadas, 0);
    const fila = (
      sb as unknown as {
        tablas: {
          ci_facturas_canal_pendientes: Array<{
            extracted?: { auto_confirm_estacion_servicio?: { motivo?: string } };
          }>;
        };
      }
    ).tablas.ci_facturas_canal_pendientes[0];
    assert.match(String(fila.extracted?.auto_confirm_estacion_servicio?.motivo), /Sin obra ni entidad/);
  });

  it('usa la obra del chat de Telegram y asegura almacén si falta', async () => {
    const espia = depsEspia();
    const r = await autoConfirmarCompraEstacionServicio(
      dbPendiente({ proyecto_id: null, ubicacion_destino_id: null }),
      'pend-eds',
      extractedEds(),
      {
        ...espia.deps,
        leerContextoTelegram: async () => ({ proyectoId: 'obra-1', procuraId: 'proc-9' }),
      },
    );
    assert.equal(r.aplicado, true);
    const args = espia.confirmarArgs[0] as {
      proyectoId: string;
      ubicacionDestinoId: string;
      procuraId?: string | null;
    };
    assert.equal(args.proyectoId, 'obra-1');
    assert.equal(args.ubicacionDestinoId, 'alm-auto');
    assert.equal(args.procuraId, 'proc-9');
  });

  it('skip: fecha crítica no auto-confirma', async () => {
    const espia = depsEspia();
    const r = await autoConfirmarCompraEstacionServicio(
      dbPendiente(),
      'pend-eds',
      extractedEds({ date: '2018-01-01' }),
      espia.deps,
    );
    assert.equal(r.aplicado, false);
    assert.equal(r.detectada, true);
    assert.match(String(r.motivo), /Fecha anómala/);
    assert.equal(espia.confirmarLlamadas, 0);
  });

  it('skip: confianza baja no llama a Confirmar', async () => {
    const espia = depsEspia();
    const r = await autoConfirmarCompraEstacionServicio(
      dbPendiente(),
      'pend-eds',
      extractedEds({ confidence_score: 20 }),
      espia.deps,
    );
    assert.equal(r.aplicado, false);
    assert.equal(r.detectada, true);
    assert.match(String(r.motivo), /Confianza OCR/);
    assert.equal(espia.confirmarLlamadas, 0);
  });

  it('skip: si Confirmar lanza, deja pendiente y no oculta el error', async () => {
    const espia = depsEspia(false);
    const r = await autoConfirmarCompraEstacionServicio(
      dbPendiente(),
      'pend-eds',
      extractedEds(),
      espia.deps,
    );
    assert.equal(r.aplicado, false);
    assert.equal(r.detectada, true);
    assert.match(String(r.motivo), /tasa BCV/);
    assert.equal(espia.confirmarLlamadas, 1);
  });

  it('EDS solo con entidad se registra como gasto operacional (sin almacén)', async () => {
    const espia = depsEspia();
    const r = await autoConfirmarCompraEstacionServicio(
      dbPendiente({ proyecto_id: null, entidad_id: 'ent-1', ubicacion_destino_id: null, chat_id: null }),
      'pend-eds',
      extractedEds(),
      { ...espia.deps, obraSugerida: async () => null },
    );
    assert.equal(r.aplicado, true);
    const args = espia.confirmarArgs[0] as {
      imputacionEntidad?: boolean;
      clasificacionGastoEntidad?: string | null;
      proyectoId: string;
      ubicacionDestinoId: string;
    };
    assert.equal(args.imputacionEntidad, true);
    assert.equal(args.clasificacionGastoEntidad, 'operacional');
    assert.equal(args.proyectoId, '');
    assert.equal(args.ubicacionDestinoId, '');
  });
});
