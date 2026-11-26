import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  capturarTelegram,
  crearFakeSupabase,
  type FakeSupabase,
} from '@/lib/telegram/testing/fakeSupabase';
import { TABLA_MOVIMIENTOS_FORMATO, manejarTextoFormatoFijo } from '@/lib/telegram/formatoFijoHandler';

const CHAT = '900';
const OBRA = 'e45497e0-5c4f-41dc-bc68-aa2274b1e100';
const ENTIDAD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ALM = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const CEMENTO = '11111111-1111-4111-8111-111111111111';

function conKardex(db: FakeSupabase): FakeSupabase {
  db.rpc = async (nombre, args?: unknown) => {
    const a = (args ?? {}) as Record<string, unknown>;
    if (nombre === 'inv_stock_apply_delta') {
      const ubi = String(a.p_ubicacion_id ?? '');
      const mat = String(a.p_material_id ?? '');
      const delta = Number(a.p_delta_disponible ?? 0);
      const filas = (db.tablas.inventario_stock ??= []);
      let row = filas.find((f) => String(f.ubicacion_id) === ubi && String(f.material_id) === mat);
      if (!row) {
        row = { ubicacion_id: ubi, material_id: mat, cantidad_disponible: 0 };
        filas.push(row);
      }
      row.cantidad_disponible = Math.max(0, Number(row.cantidad_disponible ?? 0) + delta);
      (db.tablas.inv_movimientos ??= []).push({
        ubicacion_id: ubi,
        material_id: mat,
        delta_disponible: delta,
        tipo_movimiento: a.p_tipo_movimiento,
        notas: a.p_notas,
      });
      return { data: null, error: null };
    }
    if (nombre === 'ci_registrar_ingreso_manual_campo') {
      const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10';
      const numDoc = String(a.p_num_doc ?? '');
      (db.tablas.ci_recepciones_campo ??= []).push({
        id,
        num_doc: numDoc,
        tipo: a.p_tipo,
        proyecto_id: a.p_proyecto_id,
        idempotency_key: a.p_idempotency_key,
      });
      const lineas = (a.p_lineas as Array<{ material_id: string; cantidad: number }>) ?? [];
      for (const ln of lineas) {
        const filas = (db.tablas.inventario_stock ??= []);
        let row = filas.find(
          (f) => String(f.ubicacion_id) === String(a.p_ubicacion_id) && String(f.material_id) === ln.material_id,
        );
        if (!row) {
          row = {
            ubicacion_id: a.p_ubicacion_id,
            material_id: ln.material_id,
            cantidad_disponible: 0,
          };
          filas.push(row);
        }
        row.cantidad_disponible = Number(row.cantidad_disponible ?? 0) + Number(ln.cantidad);
      }
      return { data: id, error: null };
    }
    return { data: null, error: { code: 'PGRST202', message: `rpc ${nombre}` } };
  };
  return db;
}

function dbDepositario(extra?: Record<string, Array<Record<string, unknown>>>): FakeSupabase {
  return conKardex(
    crearFakeSupabase({
      ci_proyecto_nomina: [
        { telegram_chat_id: CHAT, rol: 'depositario', activo: true, proyecto_id: OBRA },
      ],
      ci_usuarios_sistema_telegram: [],
      ci_telegram_estados: [],
      [TABLA_MOVIMIENTOS_FORMATO]: [],
      ci_proyectos: [{ id: OBRA, nombre: 'Rancho Flamboyant', entidad_id: ENTIDAD }],
      ci_entidades: [{ id: ENTIDAD, nombre: 'Casa Inteligente' }],
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
      inventario_stock: [
        { ubicacion_id: ALM, material_id: CEMENTO, cantidad_disponible: 80 },
      ],
      global_inventory: [
        {
          id: CEMENTO,
          name: 'Cemento',
          unit: 'SACO',
          sap_code: 'CEM',
          entidad_id: ENTIDAD,
          proyecto_id: OBRA,
          is_active: true,
        },
      ],
      ci_recepciones_campo: [],
      purchase_invoices: [],
      contabilidad_compras: [],
      compras_facturas: [],
      ...extra,
    }),
  );
}

describe('handler formato fijo Telegram', () => {
  let telegram: ReturnType<typeof capturarTelegram>;

  beforeEach(() => {
    telegram = capturarTelegram();
  });
  afterEach(() => {
    telegram.restaurar();
  });

  it('idempotencia: el mismo chat_id + message_id no duplica stock', async () => {
    const db = dbDepositario();
    const msg = { date: 1_700_000_000 };
    const texto = 'INGRESO\ndoc: 421\n20 cemento';
    const r1 = await manejarTextoFormatoFijo(db as unknown as SupabaseClient, {
      chatId: CHAT,
      texto,
      messageId: 77,
      message: msg,
    });
    assert.equal(r1.handled, true);
    assert.equal(r1.registrado, true);
    const stock1 = Number(
      db.tablas.inventario_stock.find((f) => String(f.material_id) === CEMENTO)?.cantidad_disponible,
    );
    const r2 = await manejarTextoFormatoFijo(db as unknown as SupabaseClient, {
      chatId: CHAT,
      texto,
      messageId: 77,
      message: msg,
    });
    assert.equal(r2.duplicate, true);
    const stock2 = Number(
      db.tablas.inventario_stock.find((f) => String(f.material_id) === CEMENTO)?.cantidad_disponible,
    );
    assert.equal(stock2, stock1);
    assert.equal(db.tablas.ci_recepciones_campo.length, 1);
  });

  it('no guarda Si como documento: genera ING-… y llama el RPC de emergencia', async () => {
    const db = dbDepositario();
    const r = await manejarTextoFormatoFijo(db as unknown as SupabaseClient, {
      chatId: CHAT,
      texto: 'INGRESO\ndoc: Si\n20 cemento',
      messageId: 88,
      message: { date: 1_700_000_000 },
    });
    assert.equal(r.registrado, true);
    const rec = db.tablas.ci_recepciones_campo[0];
    assert.ok(rec);
    assert.match(String(rec.num_doc), /^ING-/);
    assert.doesNotMatch(String(rec.num_doc), /Si|Sí|SI$/i);
    const enviado = telegram.enviados.find((m) => m.metodo === 'sendMessage');
    assert.match(String(enviado?.text ?? ''), /ING-/);
    assert.doesNotMatch(String(enviado?.text ?? ''), /doc Si/);
  });

  it('salida que supera stock queda pendiente y no mueve kardex', async () => {
    const db = dbDepositario();
    const antes = Number(
      db.tablas.inventario_stock.find((f) => String(f.material_id) === CEMENTO)?.cantidad_disponible,
    );
    const r = await manejarTextoFormatoFijo(db as unknown as SupabaseClient, {
      chatId: CHAT,
      texto: 'SALIDA\ndestino/uso: colado\n200 cemento',
      messageId: 91,
      message: { date: 1_700_000_000 },
    });
    assert.equal(r.pendiente, true);
    const despues = Number(
      db.tablas.inventario_stock.find((f) => String(f.material_id) === CEMENTO)?.cantidad_disponible,
    );
    assert.equal(despues, antes);
    const fila = db.tablas[TABLA_MOVIMIENTOS_FORMATO][0];
    assert.equal(fila?.estado, 'pendiente_revision');
    assert.match(String(telegram.enviados.at(-1)?.text ?? ''), /pendiente de revisión|Stock insuficiente/i);
  });

  it('material desconocido no se pierde: pendiente de revisión', async () => {
    const db = dbDepositario();
    const r = await manejarTextoFormatoFijo(db as unknown as SupabaseClient, {
      chatId: CHAT,
      texto: 'INVENTARIO\n8 pintura espacial',
      messageId: 92,
      message: { date: 1_700_000_000 },
    });
    assert.equal(r.pendiente, true);
    assert.equal(db.tablas[TABLA_MOVIMIENTOS_FORMATO][0]?.estado, 'pendiente_revision');
    assert.match(String(telegram.enviados.at(-1)?.text ?? ''), /pintura espacial/i);
  });

  it('INVENTARIO aplica ajuste (delta) y no pisa el stock en silencio', async () => {
    const db = dbDepositario();
    const r = await manejarTextoFormatoFijo(db as unknown as SupabaseClient, {
      chatId: CHAT,
      texto: 'INVENTARIO\n120 cemento',
      messageId: 93,
      message: { date: 1_700_000_000 },
    });
    assert.equal(r.registrado, true);
    const stock = Number(
      db.tablas.inventario_stock.find((f) => String(f.material_id) === CEMENTO)?.cantidad_disponible,
    );
    assert.equal(stock, 120);
    const mov = db.tablas.inv_movimientos[0];
    assert.equal(mov?.tipo_movimiento, 'ajuste');
    assert.equal(Number(mov?.delta_disponible), 40);
    assert.match(String(mov?.notas ?? ''), /conteo físico/i);
  });

  it('un chat que no es depositario no opera el almacén', async () => {
    const db = conKardex(
      crearFakeSupabase({
        ci_proyecto_nomina: [],
        ci_usuarios_sistema_telegram: [],
        ci_telegram_estados: [],
        [TABLA_MOVIMIENTOS_FORMATO]: [],
        ci_proyectos: [],
        inv_ubicaciones: [],
        inventario_stock: [],
        global_inventory: [],
      }),
    );
    const r = await manejarTextoFormatoFijo(db as unknown as SupabaseClient, {
      chatId: '111',
      texto: 'INGRESO\n20 cemento',
      messageId: 1,
      message: { date: 1_700_000_000 },
    });
    assert.equal(r.handled, true);
    assert.equal(r.registrado, undefined);
    assert.match(String(telegram.enviados.at(-1)?.text ?? ''), /depositario/i);
  });
});
