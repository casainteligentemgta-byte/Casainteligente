import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import { cantidadesAprobadas, cerrarCadenaTrasCuarentena, type DepsCierre } from './cerrarCadenaTrasCuarentena'

function espia() {
  const llamadas: string[] = []
  let recibidas: unknown = null
  const deps: DepsCierre = {
    cerrarRetiro: async (pi) => {
      llamadas.push(`cerrar:${pi}`)
    },
    cancelarRetiro: async (pi) => {
      llamadas.push(`cancelar:${pi}`)
    },
    marcarProcuras: async (pi, r) => {
      llamadas.push(`procuras:${pi}`)
      recibidas = r
      return 1
    },
  }
  return { deps, llamadas, recibidas: () => recibidas }
}

const sb = (filas: Array<Record<string, unknown>>) =>
  crearFakeSupabase({ quality_inspections: filas }) as unknown as SupabaseClient

describe('cierre de la cadena tras la cuarentena', () => {
  it('con líneas pendientes no cierra nada', async () => {
    const e = espia()
    const r = await cerrarCadenaTrasCuarentena(
      sb([
        { invoice_id: 'f1', status: 'APROBADO', material_id: 'm1', quantity: 2 },
        { invoice_id: 'f1', status: 'PENDIENTE', material_id: 'm2', quantity: 1 },
      ]),
      'f1',
      e.deps,
    )
    assert.equal(r.accion, 'pendiente')
    assert.deepEqual(e.llamadas, [])
  })

  it('aprobada (aunque haya rechazos): cierra el retiro y marca la procura con lo aprobado', async () => {
    const e = espia()
    const r = await cerrarCadenaTrasCuarentena(
      sb([
        { invoice_id: 'f1', status: 'APROBADO', material_id: 'm1', quantity: 2 },
        { invoice_id: 'f1', status: 'APROBADO', material_id: 'm1', quantity: 3 },
        { invoice_id: 'f1', status: 'RECHAZADO', material_id: 'm2', quantity: 4 },
        { invoice_id: 'otra', status: 'PENDIENTE', material_id: 'm9', quantity: 1 },
      ]),
      'f1',
      e.deps,
    )
    assert.equal(r.accion, 'recibida')
    assert.deepEqual(e.llamadas, ['cerrar:f1', 'procuras:f1'])
    assert.deepEqual(e.recibidas(), [{ material_id: 'm1', cantidad: 5 }])
  })

  it('todo rechazado: cancela el retiro y no toca la procura', async () => {
    const e = espia()
    const r = await cerrarCadenaTrasCuarentena(
      sb([{ invoice_id: 'f1', status: 'RECHAZADO', material_id: 'm1', quantity: 2 }]),
      'f1',
      e.deps,
    )
    assert.equal(r.accion, 'rechazada')
    assert.deepEqual(e.llamadas, ['cancelar:f1'])
  })

  it('factura sin cuarentena: nada', async () => {
    const e = espia()
    const r = await cerrarCadenaTrasCuarentena(sb([]), 'f1', e.deps)
    assert.equal(r.accion, 'sin_cuarentena')
    assert.deepEqual(e.llamadas, [])
  })

  it('un fallo al cerrar no lanza', async () => {
    const r = await cerrarCadenaTrasCuarentena(
      sb([{ invoice_id: 'f1', status: 'APROBADO', material_id: 'm1', quantity: 1 }]),
      'f1',
      {
        cerrarRetiro: async () => {
          throw new Error('caído')
        },
        cancelarRetiro: async () => {},
        marcarProcuras: async () => 0,
      },
    )
    assert.equal(r.accion, 'error')
  })

  it('suma lo aprobado por material e ignora cantidades inválidas', () => {
    assert.deepEqual(
      cantidadesAprobadas([
        { status: 'aprobado', material_id: 'a', quantity: '1.5' },
        { status: 'APROBADO', material_id: 'a', quantity: 2 },
        { status: 'APROBADO', material_id: null, quantity: 9 },
        { status: 'APROBADO', material_id: 'b', quantity: 0 },
        { status: 'RECHAZADO', material_id: 'b', quantity: 3 },
      ]),
      [{ material_id: 'a', cantidad: 3.5 }],
    )
  })
})
