import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase, type FakeSupabase } from '@/lib/telegram/testing/fakeSupabase'
import { registrarMermaAlmacen } from '@/lib/almacen/registrarMermaAlmacen'

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
    const prev = Number(row.cantidad_disponible ?? 0)
    const next = Math.max(0, prev + delta)
    row.cantidad_disponible = next
    ;(db.tablas.inv_movimientos ??= []).push({
      ubicacion_id: ubi,
      material_id: mat,
      delta_disponible: next - prev,
      tipo_movimiento: a.p_tipo_movimiento ?? 'ajuste',
      referencia_tipo: a.p_referencia_tipo,
      referencia_id: a.p_referencia_id,
      notas: a.p_notas,
    })
    return { data: null, error: null }
  }
  return db
}

function base(): FakeSupabase {
  return conKardex(
    crearFakeSupabase({
      inv_ubicaciones: [
        {
          id: UB_ALMACEN,
          codigo: 'DEP-A',
          nombre: 'Almacén Norte',
          tipo: 'almacen_central',
          ci_proyecto_id: OBRA,
          activo: true,
        },
        {
          id: UB_BAJAS,
          codigo: 'BAJAS',
          nombre: 'Deterioro y bajas',
          tipo: 'garantias',
          ci_proyecto_id: null,
          activo: true,
        },
      ],
      inventario_stock: [{ ubicacion_id: UB_ALMACEN, material_id: CEMENTO, cantidad_disponible: 10 }],
      global_inventory: [{ id: CEMENTO, name: 'Cemento gris', unit: 'SACO' }],
    }),
  )
}

describe('registrarMermaAlmacen', () => {
  it('descuenta stock, escribe transferencia retorno_merma y kardex de baja', async () => {
    const db = base()
    const r = await registrarMermaAlmacen(db as unknown as SupabaseClient, {
      origenUbicacionId: UB_ALMACEN,
      materialId: CEMENTO,
      materialNombre: 'Cemento gris',
      cantidad: 3,
      motivo: 'danado',
      chatId: '900',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.match(r.codigo, /^MER-/)
    const trf = db.tablas.transferencias_inventario[0]
    assert.equal(trf.tipo_movimiento, 'retorno_merma')
    assert.equal(trf.origen_ubicacion_id, UB_ALMACEN)
    assert.equal(trf.destino_ubicacion_id, UB_BAJAS)
    assert.equal(trf.estado, 'completado')
    assert.match(String(trf.observaciones), /Dañado/)
    const stockOrigen = db.tablas.inventario_stock.find(
      (s) => s.ubicacion_id === UB_ALMACEN && s.material_id === CEMENTO,
    )
    assert.equal(Number(stockOrigen?.cantidad_disponible), 7)
    const bajas = (db.tablas.inv_movimientos ?? []).filter((m) => m.tipo_movimiento === 'baja')
    assert.equal(bajas.length, 2)
    assert.equal(
      bajas.some((m) => m.ubicacion_id === UB_ALMACEN && Number(m.delta_disponible) === -3),
      true,
    )
  })

  it('rechaza si no hay stock suficiente', async () => {
    const db = base()
    const r = await registrarMermaAlmacen(db as unknown as SupabaseClient, {
      origenUbicacionId: UB_ALMACEN,
      materialId: CEMENTO,
      cantidad: 99,
      motivo: 'perdido',
    })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.match(r.error, /suficiente stock/)
    assert.equal(db.tablas.transferencias_inventario, undefined)
  })
})
