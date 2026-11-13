import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NOTA_ENTREGA_KIND } from '@/lib/compras/notaEntregaCanal';
import { crearFakeSupabase, capturarTelegram, botonesDe } from '@/lib/telegram/testing/fakeSupabase';
import {
  FLUJO_NOTA_ENTREGA_COMPRADOR,
  avanzarFlujoNotaEntregaCompradorTelegram,
  entidadEsDeNotaEntrega,
  esCallbackNotaEntregaComprador,
  esperandoTextoNotaEntregaComprador,
  manejarCallbackNotaEntregaComprador,
  manejarTextoNotaEntregaComprador,
  parsearRifNotaEntrega,
  siguientePasoNotaEntregaComprador,
} from './notaEntregaCompradorTelegram';

const CHAT = '8684897057';
const PEND = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const ENT_DIMA = '11111111-1111-4111-8111-111111111111';
const ENT_OTRA = '22222222-2222-4222-8222-222222222222';
const OBRA = '33333333-3333-4333-8333-333333333333';

function dbPendiente(extracted: Record<string, unknown>, extra?: Record<string, unknown>) {
  return crearFakeSupabase({
    ci_telegram_estados: [
      {
        chat_id: CHAT,
        contexto: 'factura',
        proyecto_id: null,
        pending_factura_id: PEND,
        metadata: { flujo: FLUJO_NOTA_ENTREGA_COMPRADOR, paso: 'proveedor' },
      },
    ],
    ci_facturas_canal_pendientes: [
      {
        id: PEND,
        chat_id: CHAT,
        estado: 'extraido',
        extracted: { document_kind: NOTA_ENTREGA_KIND, ...extracted },
        entidad_id: null,
        proyecto_id: null,
        created_at: '2026-11-10T12:00:00Z',
        ...extra,
      },
    ],
    ci_entidades: [
      { id: ENT_DIMA, nombre: 'DIMAQUINAS' },
      { id: ENT_OTRA, nombre: 'Otra SA' },
    ],
    ci_proyectos: [
      {
        id: OBRA,
        nombre: 'Villa Zoita',
        entidad_id: ENT_DIMA,
        tipo_proyecto: 'integral',
        obra_estado_legacy: 'activa',
      },
      {
        id: 'cerrada',
        nombre: 'Obra cerrada',
        entidad_id: ENT_DIMA,
        tipo_proyecto: 'integral',
        obra_estado_legacy: 'cerrada',
      },
    ],
    ci_proveedor_perfil: [
      { rif_normalizado: 'J-12345678-9', rif_etiqueta: 'J-12345678-9', nombre_canonico: 'Ferretería X' },
    ],
    empresas: [{ id: 'emp-1', nombre: 'Ferretería X', rif: 'J-12345678-9' }],
  }) as unknown as SupabaseClient;
}

describe('helpers nota entrega comprador', () => {
  test('callback ne: y no otros', () => {
    assert.equal(esCallbackNotaEntregaComprador('ne:p:0'), true);
    assert.equal(esCallbackNotaEntregaComprador('fe:e:abc'), false);
  });

  test('pasos: proveedor → RIF → entidad → obra; no pide precios', () => {
    assert.equal(siguientePasoNotaEntregaComprador({}), 'proveedor');
    assert.equal(siguientePasoNotaEntregaComprador({ supplier_name: 'Acme' }), 'rif');
    assert.equal(
      siguientePasoNotaEntregaComprador({ supplier_name: 'Acme', supplier_rif: 'J-1' }),
      'entidad',
    );
    assert.equal(
      siguientePasoNotaEntregaComprador(
        { supplier_name: 'Acme', supplier_rif: 'J-1' },
        { entidad_id: ENT_DIMA },
      ),
      'obra',
    );
    assert.equal(
      siguientePasoNotaEntregaComprador(
        { supplier_name: 'Acme', supplier_rif: 'J-1', total_amount: 0 },
        { entidad_id: ENT_DIMA, proyecto_id: OBRA },
      ),
      'completo',
    );
  });

  test('RIF venezolano se normaliza; basura se rechaza', () => {
    assert.equal(parsearRifNotaEntrega('j123456789'), 'J-12345678-9');
    assert.equal(parsearRifNotaEntrega('hola'), null);
  });

  test('entidades: DIMAQUINAS, Casa Inteligente, Neroca, Procodima', () => {
    assert.equal(entidadEsDeNotaEntrega('DIMAQUINAS, C.A.'), true);
    assert.equal(entidadEsDeNotaEntrega('CASA INTELIGENTE'), true);
    assert.equal(entidadEsDeNotaEntrega('Inversiones Neroca 78 Mil, C.A.'), true);
    assert.equal(entidadEsDeNotaEntrega('Procodima, C.A.'), true);
    assert.equal(entidadEsDeNotaEntrega('Otra SA'), false);
  });

  test('espera texto solo en pasos escribir', () => {
    assert.equal(
      esperandoTextoNotaEntregaComprador({
        chat_id: CHAT,
        contexto: 'factura',
        proyecto_id: null,
        pending_factura_id: PEND,
        metadata: { flujo: FLUJO_NOTA_ENTREGA_COMPRADOR, paso: 'proveedor_escribir' },
      }),
      true,
    );
    assert.equal(
      esperandoTextoNotaEntregaComprador({
        chat_id: CHAT,
        contexto: 'factura',
        proyecto_id: null,
        pending_factura_id: PEND,
        metadata: { flujo: FLUJO_NOTA_ENTREGA_COMPRADOR, paso: 'entidad' },
      }),
      false,
    );
  });
});

describe('flujo Telegram nota de entrega', () => {
  test('pide proveedor con botones (recientes + escribir) y no menciona precios', async () => {
    const sb = dbPendiente({});
    (sb as unknown as { tablas: Record<string, Array<Record<string, unknown>>> }).tablas
      .ci_facturas_canal_pendientes!.push({
        id: 'otra',
        chat_id: CHAT,
        extracted: { supplier_name: 'Cemento Zulia', supplier_rif: 'J-9' },
        created_at: '2026-11-01T10:00:00Z',
      });
    const tg = capturarTelegram();
    try {
      const paso = await avanzarFlujoNotaEntregaCompradorTelegram(sb, CHAT, PEND);
      assert.equal(paso, 'proveedor');
      const msg = tg.enviados.find((m) => m.metodo === 'sendMessage');
      assert.ok(msg);
      assert.match(String(msg!.text), /Nota de entrega/);
      assert.doesNotMatch(String(msg!.text), /precio|total|USD|Bs/i);
      const botones = botonesDe(msg);
      assert.ok(botones.some((b) => /Cemento Zulia/.test(b)));
      assert.ok(botones.some((b) => /Escribir/.test(b)));
    } finally {
      tg.restaurar();
    }
  });

  test('elegir proveedor con RIF en memoria pide confirmar RIF; luego entidad DIMAQUINAS y obra', async () => {
    const sb = dbPendiente({});
    const tablas = (sb as unknown as { tablas: Record<string, Array<Record<string, unknown>>> }).tablas;
    tablas.ci_telegram_estados![0]!.metadata = {
      flujo: FLUJO_NOTA_ENTREGA_COMPRADOR,
      paso: 'proveedor',
      proveedores: [{ key: 'FERRETERIAX', nombre: 'Ferretería X', rif: 'J-12345678-9' }],
    };
    const tg = capturarTelegram();
    try {
      const ok = await manejarCallbackNotaEntregaComprador(sb, {
        chatId: CHAT,
        callbackId: 'cb1',
        data: 'ne:p:0',
      });
      assert.equal(ok, true);
      const pendiente = tablas.ci_facturas_canal_pendientes!.find((r) => r.id === PEND)!;
      assert.equal((pendiente.extracted as { supplier_name: string }).supplier_name, 'Ferretería X');
      assert.match(String(tg.enviados.at(-1)?.text), /RIF/);
      assert.ok(botonesDe(tg.enviados.at(-1)).some((b) => /Usar este/.test(b)));

      await manejarCallbackNotaEntregaComprador(sb, {
        chatId: CHAT,
        callbackId: 'cb2',
        data: 'ne:rok',
      });
      assert.equal((pendiente.extracted as { supplier_rif: string }).supplier_rif, 'J-12345678-9');
      const entidadMsg = [...tg.enviados].reverse().find((m) => String(m.text).includes('Entidad:'));
      assert.ok(entidadMsg);
      const nombresEnt = botonesDe(entidadMsg);
      assert.ok(nombresEnt.includes('DIMAQUINAS'));
      assert.equal(nombresEnt.includes('Otra SA'), false);

      await manejarCallbackNotaEntregaComprador(sb, {
        chatId: CHAT,
        callbackId: 'cb3',
        data: `ne:e:${ENT_DIMA}`,
      });
      assert.equal(pendiente.entidad_id, ENT_DIMA);
      const obraMsg = [...tg.enviados].reverse().find((m) => String(m.text).startsWith('Obra'));
      assert.ok(obraMsg);
      const nombresObra = botonesDe(obraMsg);
      assert.ok(nombresObra.includes('Villa Zoita'));
      assert.equal(nombresObra.includes('Obra cerrada'), false);

      await manejarCallbackNotaEntregaComprador(sb, {
        chatId: CHAT,
        callbackId: 'cb4',
        data: `ne:o:${OBRA}`,
      });
      assert.equal(pendiente.proyecto_id, OBRA);
      assert.match(String(tg.enviados.at(-1)?.text), /Luis cargará los precios/);
      assert.doesNotMatch(tg.enviados.map((m) => m.text).join('\n'), /precio unitario|Total:/i);
    } finally {
      tg.restaurar();
    }
  });

  test('escribir proveedor y RIF a mano', async () => {
    const sb = dbPendiente({});
    const tablas = (sb as unknown as { tablas: Record<string, Array<Record<string, unknown>>> }).tablas;
    tablas.ci_telegram_estados![0]!.metadata = {
      flujo: FLUJO_NOTA_ENTREGA_COMPRADOR,
      paso: 'proveedor_escribir',
    };
    const tg = capturarTelegram();
    try {
      const handled = await manejarTextoNotaEntregaComprador(sb, CHAT, 'Suministros Andes');
      assert.equal(handled, true);
      const pendiente = tablas.ci_facturas_canal_pendientes!.find((r) => r.id === PEND)!;
      assert.equal((pendiente.extracted as { supplier_name: string }).supplier_name, 'Suministros Andes');

      tablas.ci_telegram_estados![0]!.metadata = {
        flujo: FLUJO_NOTA_ENTREGA_COMPRADOR,
        paso: 'rif_escribir',
      };
      const rifOk = await manejarTextoNotaEntregaComprador(sb, CHAT, 'J-29570569-7');
      assert.equal(rifOk, true);
      assert.equal((pendiente.extracted as { supplier_rif: string }).supplier_rif, 'J-29570569-7');
    } finally {
      tg.restaurar();
    }
  });
});
