import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  botonesDe,
  capturarTelegram,
  crearFakeSupabase,
  type FakeSupabase,
} from '@/lib/telegram/testing/fakeSupabase'
import {
  manejarCallbackMermaTelegram,
  manejarComandoMermaTelegram,
  manejarTextoMermaTelegram,
} from '@/lib/telegram/mermaTelegram'

const CHAT = '900'
const UB_ALMACEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const UB_BAJAS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
const CEMENTO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OBRA = '11111111-1111-4111-8111-111111111111'

function conKardex(db: FakeSupabase): FakeSupabase {
  db.rpc = async (nombre, args?: unknown) => {
    if (nombre !== 'inv_stock_apply_delta') {
      return { data: null, error: { code: 'PGRST202', message: `rpc ${nombre}` } }
    }
    const a = (args ?? {}) as Record<string, unknown>
    const ubi = String(a.p_ubicacion_id ?? '')
    const mat = String(a.p_material_id ?? '')
    const delta = Number(a.p_delta_disponible ?? 0)
    const filas = (db.tablas.inventario_stock ??= [])
    let row = filas.find((f) => String(f.ubicacion_id) === ubi && String(f.material_id) === mat)
    if (!row) {
      row = { ubicacion_id: ubi, material_id: mat, cantidad_disponible: 0 }
      filas.push(row)
    }
    row.cantidad_disponible = Math.max(0, Number(row.cantidad_disponible ?? 0) + delta)
    return { data: null, error: null }
  }
  return db
}

function dbDepositario(): FakeSupabase {
  return conKardex(
    crearFakeSupabase({
      ci_proyecto_nomina: [{ telegram_chat_id: CHAT, rol: 'depositario', activo: true }],
      ci_usuarios_sistema_telegram: [],
      ci_telegram_estados: [],
      ci_proyectos: [{ id: OBRA, nombre: 'Obra Norte' }],
      inv_ubicaciones: [
        {
          id: UB_ALMACEN,
          codigo: 'DEP-A',
          nombre: 'Almacén Norte',
          tipo: 'almacen_central',
          ci_proyecto_id: OBRA,
          activo: true,
          ubicacion_padre_id: null,
        },
        {
          id: UB_BAJAS,
          codigo: 'BAJAS',
          nombre: 'Deterioro y bajas',
          tipo: 'garantias',
          ci_proyecto_id: null,
          activo: true,
          ubicacion_padre_id: null,
        },
      ],
      inventario_stock: [{ ubicacion_id: UB_ALMACEN, material_id: CEMENTO, cantidad_disponible: 10 }],
      global_inventory: [{ id: CEMENTO, name: 'Cemento gris', unit: 'SACO' }],
    }),
  )
}

describe('Telegram deterioro / merma', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    telegram = capturarTelegram()
  })
  afterEach(() => {
    telegram.restaurar()
  })

  it('rechaza a quien no es depositario ni admin', async () => {
    const db = crearFakeSupabase({
      ci_proyecto_nomina: [],
      ci_usuarios_sistema_telegram: [],
      ci_telegram_estados: [],
    })
    await manejarComandoMermaTelegram(db as unknown as SupabaseClient, '300')
    assert.match(String(telegram.enviados.at(-1)?.text), /Solo el depositario/)
  })

  it('recorre almacén → producto → cantidad → motivo → omitir foto → confirma baja', async () => {
    const db = dbDepositario()
    const sb = db as unknown as SupabaseClient
    await manejarComandoMermaTelegram(sb, CHAT)
    assert.match(String(telegram.enviados.at(-1)?.text), /almacén/i)
    assert.ok(botonesDe(telegram.enviados.at(-1)).some((t) => /Almacén Norte/i.test(t)))

    await manejarCallbackMermaTelegram(sb, {
      chatId: CHAT,
      callbackId: 'cb',
      data: `mr:ub:${UB_ALMACEN}`,
    })
    assert.match(String(telegram.enviados.at(-1)?.text), /producto/i)

    await manejarCallbackMermaTelegram(sb, {
      chatId: CHAT,
      callbackId: 'cb',
      data: `mr:mat:${CEMENTO}`,
    })
    assert.match(String(telegram.enviados.at(-1)?.text), /Cuántos/)

    const texto = await manejarTextoMermaTelegram(sb, CHAT, '2')
    assert.equal(texto, true)
    assert.ok(botonesDe(telegram.enviados.at(-1)).includes('Dañado'))

    await manejarCallbackMermaTelegram(sb, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'mr:mo:danado',
    })
    assert.ok(botonesDe(telegram.enviados.at(-1)).some((t) => /Omitir/i.test(t)))

    await manejarCallbackMermaTelegram(sb, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'mr:foto:skip',
    })
    assert.match(String(telegram.enviados.at(-1)?.text), /Confirmar baja/)

    await manejarCallbackMermaTelegram(sb, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'mr:ok',
    })
    assert.match(String(telegram.enviados.at(-1)?.text), /Baja registrada/)
    const trf = db.tablas.transferencias_inventario[0]
    assert.equal(trf.tipo_movimiento, 'retorno_merma')
    assert.equal(trf.estado, 'completado')
    const stock = db.tablas.inventario_stock.find(
      (s) => s.ubicacion_id === UB_ALMACEN && s.material_id === CEMENTO,
    )
    assert.equal(Number(stock?.cantidad_disponible), 8)
  })
})
