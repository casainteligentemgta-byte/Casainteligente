import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { repartirRecibido } from './ajustarCuarentenaARecibido'

describe('cuarentena ajustada a lo recibido', () => {
  const q = (id: string, material_id: string, quantity: number) => ({ id, material_id, quantity, purchase_detail_id: null })
  it('aprueba lo contado y deja el faltante', () => {
    assert.deepEqual(repartirRecibido([q('a', 'm1', 60)], [{ material_id: 'm1', cantidad: 55 }]), [
      { inspeccionId: 'a', materialId: 'm1', aprobar: 55, faltante: 5 },
    ])
  })
  it('reparte entre varias líneas del mismo material, en orden', () => {
    assert.deepEqual(repartirRecibido([q('a', 'm1', 30), q('b', 'm1', 30)], [{ material_id: 'm1', cantidad: 40 }]), [
      { inspeccionId: 'b', materialId: 'm1', aprobar: 10, faltante: 20 },
    ])
  })
  it('no toca lo que llegó completo, lo contado de más ni los materiales sin conteo', () => {
    assert.deepEqual(repartirRecibido([q('a', 'm1', 10), q('b', 'm2', 5)], [{ material_id: 'm1', cantidad: 12 }]), [])
  })
  it('si no llegó nada, la línea queda sin aprobar', () => {
    assert.deepEqual(repartirRecibido([q('a', 'm1', 10)], [{ material_id: 'm1', cantidad: 0 }]), [
      { inspeccionId: 'a', materialId: 'm1', aprobar: 0, faltante: 10 },
    ])
  })
})
