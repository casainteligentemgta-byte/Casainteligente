import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { transitoNetoPorDocumento } from './stockTransitoCompra'

describe('transitoNetoPorDocumento', () => {
  it('suma entradas y liberaciones del mismo documento y material', () => {
    const r = transitoNetoPorDocumento([
      { ubicacion_id: 'ub1', material_id: 'm1', delta_transito_entrante: 17 },
      { ubicacion_id: 'ub1', material_id: 'm1', delta_transito_entrante: -5 },
    ])
    assert.deepEqual(r, [{ ubicacionId: 'ub1', materialId: 'm1', cantidad: 12 }])
  })

  it('separa por ubicación y material', () => {
    const r = transitoNetoPorDocumento([
      { ubicacion_id: 'ub1', material_id: 'm1', delta_transito_entrante: 16 },
      { ubicacion_id: 'ub2', material_id: 'm1', delta_transito_entrante: 1 },
      { ubicacion_id: 'ub1', material_id: 'm2', delta_transito_entrante: 2 },
    ])
    assert.equal(r.length, 3)
  })

  it('un documento ya recibido por completo no deja tránsito que revertir', () => {
    const r = transitoNetoPorDocumento([
      { ubicacion_id: 'ub1', material_id: 'm1', delta_transito_entrante: 16 },
      { ubicacion_id: 'ub1', material_id: 'm1', delta_transito_entrante: -16 },
    ])
    assert.deepEqual(r, [])
  })

  it('ignora filas sin ubicación o material y valores nulos', () => {
    const r = transitoNetoPorDocumento([
      { ubicacion_id: '', material_id: 'm1', delta_transito_entrante: 5 },
      { ubicacion_id: 'ub1', material_id: 'm1', delta_transito_entrante: null },
    ])
    assert.deepEqual(r, [])
  })
})
