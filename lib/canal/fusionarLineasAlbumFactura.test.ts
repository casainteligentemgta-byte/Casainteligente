import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  fusionarLineasAlbum,
  totalesAlbumCuadran,
  type LineaAlbumFactura,
} from './fusionarLineasAlbumFactura'

function linea(
  description: string,
  quantity: number,
  unit_price: number,
  item_code = '',
): LineaAlbumFactura {
  return { description, item_code, unit: 'UND', quantity, unit_price }
}

describe('fusionarLineasAlbum', () => {
  it('elimina la fila repetida del solape entre fotos', () => {
    const fused = fusionarLineasAlbum([
      linea('Cemento 50kg', 10, 25),
      linea('Cabilla 3/8', 20, 8),
      linea('Cemento 50kg', 10, 25),
      linea('Pintura blanca', 4, 12),
    ])
    assert.equal(fused.length, 3)
    assert.deepEqual(
      fused.map((l) => l.description),
      ['Cemento 50kg', 'Cabilla 3/8', 'Pintura blanca'],
    )
  })

  it('no fusiona el mismo producto con distinta cantidad', () => {
    const fused = fusionarLineasAlbum([
      linea('Cemento 50kg', 10, 25),
      linea('Cemento 50kg', 5, 25),
    ])
    assert.equal(fused.length, 2)
  })
})

describe('totalesAlbumCuadran', () => {
  it('acepta suma igual al total', () => {
    const r = totalesAlbumCuadran({
      items: [linea('A', 2, 10), linea('B', 1, 5)],
      total: 25,
    })
    assert.equal(r.ok, true)
    assert.equal(r.sumaLineas, 25)
  })

  it('acepta líneas sin IVA y total con IVA 16 %', () => {
    const r = totalesAlbumCuadran({
      items: [linea('A', 1, 100)],
      total: 116,
    })
    assert.equal(r.ok, true)
  })

  it('marca revisión si falta el total', () => {
    const r = totalesAlbumCuadran({
      items: [linea('A', 1, 10)],
      total: null,
    })
    assert.equal(r.ok, false)
    assert.equal(r.motivo, 'sin_total')
  })

  it('marca descuadre si la diferencia supera la tolerancia', () => {
    const r = totalesAlbumCuadran({
      items: [linea('A', 1, 10)],
      total: 80,
    })
    assert.equal(r.ok, false)
    assert.equal(r.motivo, 'descuadre')
  })
})
