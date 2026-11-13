import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';
import {
  construirMensajeRecordatorioComprador,
  enviarRecordatorioCompradores,
  esFacturaPendienteDeConfirmar,
  esHoraDeRecordatorio,
  facturaDesdePendienteCanal,
  facturaNecesitaNuevaFoto,
  formatearLineaFacturaRecordatorio,
  formatearMontoEs,
  MAX_LINEAS_FACTURA_RECORDATORIO,
  urlConfirmarFacturaCanal,
  ventanaCaracas,
  type FacturaRecordatorioComprador,
} from './recordatorioCompradores';

const NEO = '8684897057';
const BASE = 'https://casainteligente.company';
const ID_NEO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

function factura(
  partial: Partial<FacturaRecordatorioComprador> & { id: string },
): FacturaRecordatorioComprador {
  return {
    chatId: NEO,
    createdAt: '2026-11-01T10:00:00Z',
    numero: 'F-100',
    proveedor: 'Ferretería X',
    fecha: '2026-11-01',
    monto: 1500,
    moneda: 'VES',
    preciosEnCero: false,
    ...partial,
  };
}

describe('horario Caracas', () => {
  // 2026-10-21 (miércoles). Caracas = UTC-4.
  test('dentro de horario de oficina en Caracas (9,10,11,13,14,15)', () => {
    assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T13:00:00Z')), true); // 9:00
    assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T19:00:00Z')), true); // 15:00
  });

  test('fuera de horario: 12:00, 16:00 y 8:00 Caracas', () => {
    assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T16:00:00Z')), false); // 12:00
    assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T20:00:00Z')), false); // 16:00
    assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T12:00:00Z')), false); // 8:00
  });

  test('fines de semana no recuerdan', () => {
    assert.equal(esHoraDeRecordatorio(new Date('2026-10-24T13:00:00Z')), false); // sábado 9:00
    assert.equal(esHoraDeRecordatorio(new Date('2026-10-25T13:00:00Z')), false); // domingo 9:00
  });

  test('ventanaCaracas devuelve hora y día correctos', () => {
    assert.deepEqual(ventanaCaracas(new Date('2026-10-21T13:00:00Z')), { hora: 9, diaSemana: 3 });
  });
});

describe('filtro de facturas pendientes de confirmar', () => {
  test('extraido o error sin purchase_invoice_id sí; confirmada no', () => {
    assert.equal(esFacturaPendienteDeConfirmar({ estado: 'extraido', purchase_invoice_id: null }), true);
    assert.equal(esFacturaPendienteDeConfirmar({ estado: 'error', purchase_invoice_id: '' }), true);
    assert.equal(esFacturaPendienteDeConfirmar({ estado: 'error_ocr', purchase_invoice_id: null }), true);
    assert.equal(
      esFacturaPendienteDeConfirmar({ estado: 'extraido', purchase_invoice_id: 'pi-1' }),
      false,
    );
    assert.equal(esFacturaPendienteDeConfirmar({ estado: 'confirmado', purchase_invoice_id: null }), false);
    assert.equal(esFacturaPendienteDeConfirmar({ estado: 'procesando', purchase_invoice_id: null }), false);
  });
});

describe('formateo del mensaje de recordatorio', () => {
  test('formatearMontoEs usa miles con punto y decimales con coma', () => {
    assert.equal(formatearMontoEs(1500), '1.500,00');
    assert.equal(formatearMontoEs(12.5), '12,50');
    assert.equal(formatearMontoEs(0), '0,00');
  });

  test('línea completa: número, proveedor, fecha, monto con moneda y enlace', () => {
    const linea = formatearLineaFacturaRecordatorio(
      factura({ id: ID_NEO }),
      BASE,
    );
    assert.equal(
      linea,
      `• F-100 · Ferretería X · 01/11/2026 · 1.500,00 Bs · <a href="${BASE}/contabilidad/compras/telegram/${ID_NEO}">confirmar</a>`,
    );
  });

  test('sin número ni proveedor, y sin fecha/monto, usa placeholders', () => {
    const linea = formatearLineaFacturaRecordatorio(
      factura({
        id: ID_NEO,
        numero: null,
        proveedor: 'Acme',
        fecha: null,
        monto: null,
        moneda: 'USD',
        preciosEnCero: false,
      }),
      BASE,
    );
    assert.match(linea, /^• sin número · Acme · <a href=/);
    assert.doesNotMatch(linea, /tómale de nuevo/);
  });

  test('si faltan proveedor y moneda, pide retomar la foto', () => {
    assert.equal(
      facturaNecesitaNuevaFoto({ proveedor: null, moneda: null, preciosEnCero: false }),
      true,
    );
    const linea = formatearLineaFacturaRecordatorio(
      factura({
        id: ID_NEO,
        numero: null,
        proveedor: null,
        fecha: '2026-11-02',
        monto: 80,
        moneda: null,
        preciosEnCero: false,
      }),
      BASE,
    );
    assert.match(linea, /sin número · sin proveedor · 02\/11\/2026 · 80,00 · tómale de nuevo la foto completa y reenvíala/);
  });

  test('si todos los precios están en 0, pide retomar la foto aunque haya proveedor', () => {
    assert.equal(
      facturaNecesitaNuevaFoto({ proveedor: 'Acme', moneda: 'USD', preciosEnCero: true }),
      true,
    );
    const linea = formatearLineaFacturaRecordatorio(
      factura({ id: 'id-0', proveedor: 'Acme', moneda: 'USD', monto: 0, preciosEnCero: true }),
      BASE,
    );
    assert.match(linea, /tómale de nuevo la foto completa y reenvíala/);
  });

  test('con proveedor o moneda no pide foto (salvo precios en 0)', () => {
    assert.equal(
      facturaNecesitaNuevaFoto({ proveedor: 'Acme', moneda: null, preciosEnCero: false }),
      false,
    );
    assert.equal(
      facturaNecesitaNuevaFoto({ proveedor: null, moneda: 'USD', preciosEnCero: false }),
      false,
    );
  });

  test('encabezado, una línea por factura y enlace de confirmación', () => {
    const msg = construirMensajeRecordatorioComprador(
      [
        factura({ id: 'f1', numero: 'A-1', createdAt: '2026-11-02T10:00:00Z' }),
        factura({
          id: 'f2',
          numero: 'B-2',
          proveedor: 'Cemento Zulia',
          fecha: '2026-10-28',
          monto: 40,
          moneda: 'USD',
          createdAt: '2026-10-28T10:00:00Z',
        }),
      ],
      { baseUrl: BASE },
    );
    assert.ok(msg);
    const lineas = msg!.split('\n');
    assert.equal(lineas[0], 'Tienes 2 facturas pendientes de confirmar:');
    assert.match(lineas[1], /B-2 · Cemento Zulia · 28\/10\/2026 · 40,00 USD/);
    assert.match(lineas[2], /A-1 · Ferretería X/);
    assert.match(msg!, /\/contabilidad\/compras\/telegram\/f2/);
    assert.doesNotMatch(msg!, /Recordatorio de compras/);
  });

  test('singular cuando hay una sola factura', () => {
    const msg = construirMensajeRecordatorioComprador([factura({ id: 'f1' })], { baseUrl: BASE });
    assert.equal(msg!.split('\n')[0], 'Tienes 1 factura pendiente de confirmar:');
  });

  test('sin pendientes no arma mensaje', () => {
    assert.equal(construirMensajeRecordatorioComprador([]), null);
  });

  test('máximo 15 facturas más antiguas y “y N más”', () => {
    const muchas = Array.from({ length: 17 }, (_, i) =>
      factura({
        id: `f-${String(i).padStart(2, '0')}`,
        numero: `N-${i}`,
        createdAt: `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
      }),
    );
    const msg = construirMensajeRecordatorioComprador(muchas, { baseUrl: BASE });
    const lineas = msg!.split('\n');
    assert.equal(lineas[0], 'Tienes 17 facturas pendientes de confirmar:');
    assert.equal(lineas.length, 1 + MAX_LINEAS_FACTURA_RECORDATORIO + 1);
    assert.equal(lineas[1]?.includes('N-0'), true, 'la más antigua primero');
    assert.equal(lineas.at(-1), 'y 2 más');
    assert.doesNotMatch(msg!, /N-15/);
  });

  test('escapa HTML del proveedor y del número', () => {
    const msg = construirMensajeRecordatorioComprador(
      [
        factura({
          id: 'f1',
          numero: '<script>',
          proveedor: 'A & B <x>',
        }),
      ],
      { baseUrl: BASE },
    );
    assert.ok(msg);
    assert.ok(!msg!.includes('<script>'));
    assert.match(msg!, /&lt;script&gt;/);
    assert.match(msg!, /A &amp; B &lt;x&gt;/);
  });

  test('url de confirmación', () => {
    assert.equal(
      urlConfirmarFacturaCanal('abc-1', 'https://casainteligente.company/'),
      'https://casainteligente.company/contabilidad/compras/telegram/abc-1',
    );
  });
});

describe('mapeo desde ci_facturas_canal_pendientes', () => {
  test('lee número, proveedor, fecha y precios en 0 si no hay montos', () => {
    const f = facturaDesdePendienteCanal({
      id: 'p1',
      chat_id: NEO,
      estado: 'extraido',
      purchase_invoice_id: null,
      created_at: '2026-11-10T12:00:00Z',
      extracted: { invoice_number: '  ', supplier_name: '', items: [{ unit_price: 0 }] },
    });
    assert.ok(f);
    assert.equal(f!.numero, null);
    assert.equal(f!.proveedor, null);
    assert.equal(f!.fecha, '2026-11-10');
    assert.equal(f!.preciosEnCero, true);
    assert.equal(facturaNecesitaNuevaFoto(f!), true);
  });

  test('ignora filas confirmadas o de otro estado', () => {
    assert.equal(
      facturaDesdePendienteCanal({
        id: 'p2',
        chat_id: NEO,
        estado: 'confirmado',
        purchase_invoice_id: 'pi',
        extracted: { invoice_number: 'Z' },
      }),
      null,
    );
  });
});

describe('envío por comprador', () => {
  test('Neo recibe solo SUS pendientes; quien no tiene no recibe nada', async () => {
    const supabase = crearFakeSupabase({
      ci_usuarios_sistema_telegram: [
        { telegram_id: Number(NEO), rol: 'Comprador', activo: true, nombre: 'Neo' },
        { telegram_id: 111, rol: 'Comprador', activo: true, nombre: 'Otro' },
      ],
      ci_proyecto_nomina: [],
      ci_facturas_canal_pendientes: [
        {
          id: 'pend-neo',
          chat_id: NEO,
          estado: 'extraido',
          purchase_invoice_id: null,
          created_at: '2026-11-01T10:00:00Z',
          extracted: {
            invoice_number: 'F-88',
            supplier_name: 'Suministros Andes',
            date: '2026-11-01',
            total_amount: 250,
            moneda: 'USD',
          },
        },
        {
          id: 'pend-confirmada',
          chat_id: NEO,
          estado: 'extraido',
          purchase_invoice_id: 'ya-ok',
          created_at: '2026-10-01T10:00:00Z',
          extracted: { invoice_number: 'NO' },
        },
        {
          id: 'pend-otro-chat',
          chat_id: '999',
          estado: 'extraido',
          purchase_invoice_id: null,
          created_at: '2026-11-01T10:00:00Z',
          extracted: { invoice_number: 'AJENA' },
        },
      ],
    }) as unknown as SupabaseClient;

    const enviados: Array<{ chatId: string; html: string }> = [];
    const r = await enviarRecordatorioCompradores(supabase, {
      baseUrl: BASE,
      enviar: async (chatId, html) => {
        enviados.push({ chatId, html });
      },
    });

    assert.equal(r.total, 2);
    assert.equal(r.enviados, 1);
    assert.equal(r.omitidos, 1);
    assert.equal(r.facturas, 1);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0]!.chatId, NEO);
    assert.match(enviados[0]!.html, /^Tienes 1 factura pendiente de confirmar:/);
    assert.match(enviados[0]!.html, /F-88 · Suministros Andes · 01\/11\/2026 · 250,00 USD/);
    assert.match(enviados[0]!.html, /\/contabilidad\/compras\/telegram\/pend-neo/);
    assert.doesNotMatch(enviados[0]!.html, /AJENA|NO\b|Recordatorio de compras/);
    assert.doesNotMatch(enviados[0]!.html, /TELEGRAM_BOT_TOKEN|bot[0-9]+:/i);
  });

  test('si nadie tiene pendientes, no envía', async () => {
    const supabase = crearFakeSupabase({
      ci_usuarios_sistema_telegram: [
        { telegram_id: Number(NEO), rol: 'Comprador', activo: true, nombre: 'Neo' },
      ],
      ci_proyecto_nomina: [],
      ci_facturas_canal_pendientes: [
        {
          id: 'ok',
          chat_id: NEO,
          estado: 'confirmado',
          purchase_invoice_id: 'pi',
          extracted: { invoice_number: 'X' },
        },
      ],
    }) as unknown as SupabaseClient;

    let llamados = 0;
    const r = await enviarRecordatorioCompradores(supabase, {
      enviar: async () => {
        llamados += 1;
      },
    });
    assert.equal(r.enviados, 0);
    assert.equal(r.omitidos, 1);
    assert.equal(llamados, 0);
  });
});
