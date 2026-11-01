import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { tieneSaldoNoDisponible } from './eliminarMovimientoInventario'

describe('tieneSaldoNoDisponible', () => {
  it('sin tránsito ni reservado no bloquea el borrado', () => {
    assert.equal(tieneSaldoNoDisponible({ cantidad_reservada: 0, cantidad_en_transito_entrante: 0 }), false)
    assert.equal(tieneSaldoNoDisponible({ cantidad_reservada: null, cantidad_en_transito_entrante: null }), false)
    assert.equal(tieneSaldoNoDisponible({}), false)
  })

  it('mercancía en tránsito bloquea el borrado (caso Arena Fina: 16 u.)', () => {
    assert.equal(tieneSaldoNoDisponible({ cantidad_reservada: 0, cantidad_en_transito_entrante: 16 }), true)
    assert.equal(tieneSaldoNoDisponible({ cantidad_reservada: '0.0000', cantidad_en_transito_entrante: '16.0000' }), true)
  })

  it('material reservado bloquea el borrado', () => {
    assert.equal(tieneSaldoNoDisponible({ cantidad_reservada: 3, cantidad_en_transito_entrante: 0 }), true)
  })
})
