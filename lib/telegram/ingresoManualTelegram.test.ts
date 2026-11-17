import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  capturarTelegram,
  crearFakeSupabase,
  type FakeSupabase,
} from '@/lib/telegram/testing/fakeSupabase';
import {
  debePedirCategoriaMaterialIngreso,
  esFlujoIngresoManual,
  manejarCallbackIngresoManual,
  manejarFotoIngresoManual,
  MENSAJE_INGRESO_PASO_VENCIDO,
  MENSAJE_INGRESO_USAR_BOTONES,
} from '@/lib/telegram/ingresoManualTelegram';
import type { TelegramEstado } from '@/lib/telegram/estados';

const CHAT = '8974680668';
const OBRA = 'e45497e0-5c4f-41dc-bc68-aa2274b1e100';
const ENTIDAD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CEMENTO = '11111111-1111-4111-8111-111111111111';
const CAT = '22222222-2222-4222-8222-222222222222';
const ALM = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

function estadoBase(patch: Partial<TelegramEstado> & { metadata?: Record<string, unknown> }): TelegramEstado {
  return {
    chat_id: CHAT,
    contexto: 'entrada_obra',
    proyecto_id: OBRA,
    pending_factura_id: null,
    metadata: {},
    ...patch,
  } as TelegramEstado;
}

function dbIngreso(opts?: {
  contexto?: string;
  metadata?: Record<string, unknown>;
  material?: Record<string, unknown>;
}): FakeSupabase {
  return crearFakeSupabase({
    ci_telegram_estados: [
      {
        chat_id: CHAT,
        contexto: opts?.contexto ?? 'entrada_obra',
        proyecto_id: OBRA,
        pending_factura_id: null,
        metadata: {
          flujo: 'nota_entrega_ingreso',
          paso: 'categoria',
          ubicacion_id: ALM,
          ubicacion_nombre: 'Almacén Rancho Flamboyant',
          draft_material_id: CEMENTO,
          draft_material_nombre: 'Cemento',
          draft_unidad: 'SACO',
          draft_cantidad: 4,
          ...opts?.metadata,
        },
      },
    ],
    ci_proyectos: [{ id: OBRA, nombre: 'Rancho Flamboyant', entidad_id: ENTIDAD }],
    ci_entidades: [{ id: ENTIDAD, nombre: 'Casa Inteligente' }],
    material_categories: [{ id: CAT, name: 'Materiales', level: 1, parent_id: null }],
    global_inventory: [
      opts?.material ?? {
        id: CEMENTO,
        name: 'Cemento',
        unit: 'SACO',
        category_id: null,
        entidad_id: ENTIDAD,
        proyecto_id: OBRA,
        is_active: true,
      },
    ],
    inv_ubicaciones: [
      {
        id: ALM,
        codigo: 'DEP-RANCHO',
        nombre: 'Almacén Rancho Flamboyant',
        tipo: 'almacen_central',
        ci_proyecto_id: OBRA,
        activo: true,
        ubicacion_padre_id: null,
      },
    ],
    inventario_stock: [],
    ci_proyecto_nomina: [{ telegram_chat_id: CHAT, rol: 'depositario', activo: true, proyecto_id: OBRA }],
    ci_usuarios_sistema_telegram: [],
  });
}

function metadata(db: FakeSupabase): Record<string, unknown> {
  return db.tablas.ci_telegram_estados[0].metadata as Record<string, unknown>;
}

describe('esFlujoIngresoManual por metadata.flujo', () => {
  it('sigue activo aunque el contexto haya cambiado a obra', () => {
    assert.equal(
      esFlujoIngresoManual(
        estadoBase({
          contexto: 'obra',
          metadata: { flujo: 'nota_entrega_ingreso', paso: 'categoria' },
        }),
      ),
      true,
    );
  });

  it('no es ingreso si no hay flujo de recepción', () => {
    assert.equal(esFlujoIngresoManual(estadoBase({ contexto: 'entrada_obra', metadata: {} })), false);
  });
});

describe('categoría solo para material nuevo', () => {
  it('material existente sin category_id no pide categoría', () => {
    assert.equal(debePedirCategoriaMaterialIngreso('nota_entrega_ingreso', false), false);
  });

  it('material nuevo en nota de entrega sí puede pedir categoría', () => {
    assert.equal(debePedirCategoriaMaterialIngreso('nota_entrega_ingreso', true), true);
  });
});

describe('ingreso Telegram: foto extra y categoría', () => {
  let telegram: ReturnType<typeof capturarTelegram>;

  beforeEach(() => {
    telegram = capturarTelegram();
  });
  afterEach(() => telegram.restaurar());

  it('foto extra durante paso categoria no cambia contexto y el botón sigue funcionando', async () => {
    const db = dbIngreso({ contexto: 'obra' });
    const sb = db as unknown as SupabaseClient;

    const handledFoto = await manejarFotoIngresoManual({
      supabase: sb,
      chatId: CHAT,
      userId: '1',
      buffer: Buffer.from('jpg'),
      mimeType: 'image/jpeg',
      ext: 'jpg',
    });
    assert.equal(handledFoto, true);
    assert.equal(db.tablas.ci_telegram_estados[0].contexto, 'obra');
    assert.equal(metadata(db).flujo, 'nota_entrega_ingreso');
    assert.equal(metadata(db).paso, 'categoria');
    assert.equal(db.subidas.length, 0);
    assert.match(String(telegram.enviados.at(-1)?.text), /botones|\/cancelar/i);
    assert.equal(String(telegram.enviados.at(-1)?.text), MENSAJE_INGRESO_USAR_BOTONES);

    const handledCb = await manejarCallbackIngresoManual(sb, {
      chatId: CHAT,
      callbackId: 'cb-cat',
      data: `im:cat:${CAT}`,
    });
    assert.equal(handledCb, true);
    assert.equal(
      telegram.enviados.some((e) => e.metodo === 'answerCallbackQuery'),
      true,
    );
    assert.equal(metadata(db).paso, 'cantidad');
    assert.equal(metadata(db).flujo, 'nota_entrega_ingreso');
    assert.equal(db.tablas.ci_telegram_estados[0].contexto, 'obra');
  });

  it('callback im: sin ingreso activo responde que el paso venció', async () => {
    const db = crearFakeSupabase({
      ci_telegram_estados: [
        { chat_id: CHAT, contexto: 'menu', proyecto_id: null, pending_factura_id: null, metadata: {} },
      ],
    });
    const handled = await manejarCallbackIngresoManual(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb-viejo',
      data: `im:cat:${CAT}`,
    });
    assert.equal(handled, true);
    const alerta = telegram.enviados.find((e) => e.metodo === 'answerCallbackQuery');
    assert.equal(alerta?.text, MENSAJE_INGRESO_PASO_VENCIDO);
  });

  it('material existente sin category_id no pide categoría al elegirlo', async () => {
    const db = dbIngreso({
      metadata: {
        paso: 'material',
        draft_material_id: undefined,
        draft_material_nombre: undefined,
        draft_unidad: undefined,
        draft_cantidad: undefined,
      },
    });
    const handled = await manejarCallbackIngresoManual(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb-mat',
      data: `im:mat:${CEMENTO}`,
    });
    assert.equal(handled, true);
    const textos = telegram.enviados.map((e) => String(e.text ?? '')).join('\n');
    assert.equal(/Categoría del material/i.test(textos), false);
    assert.equal(metadata(db).paso, 'cantidad');
    assert.match(textos, /cantidad/i);
  });
});
