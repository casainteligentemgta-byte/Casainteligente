import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MARGEN_CATALOGO_DEFECTO,
  MARGEN_VENTAS_DEFECTO,
  acotarMargenPct,
  aplicarMargenACosto,
  margenEfectivoProducto,
  margenPctDesdePrecios,
  precioVentaDesdeCosto,
  productoSinMargen,
  utilidadDesdePrecios,
} from './margenCatalogo'

describe('margen del catálogo', () => {
  it('el 20 % es el mismo número que NetVision', () => {
    assert.equal(MARGEN_CATALOGO_DEFECTO, 20)
    assert.equal(MARGEN_VENTAS_DEFECTO, 20)
  })

  it('precio de venta = costo × (1 + margen/100)', () => {
    assert.equal(precioVentaDesdeCosto(100, 20), 120)
    assert.equal(precioVentaDesdeCosto(12.34, 20), 14.81)
    assert.equal(precioVentaDesdeCosto(10, 0), 10)
    assert.equal(aplicarMargenACosto(50, 20).utilidad, 10)
    assert.equal(aplicarMargenACosto(50, 20).margen_pct, 20)
  })

  it('el margen se lee del precio sobre el costo, no sobre la venta', () => {
    assert.equal(margenPctDesdePrecios(100, 120), 20)
    assert.equal(margenPctDesdePrecios(10, 10), 0)
    assert.equal(margenPctDesdePrecios(0, 10), null)
    assert.equal(utilidadDesdePrecios(10, 12), 2)
  })

  it('sin margen: precio igual al costo (o sin precio de venta)', () => {
    assert.equal(productoSinMargen({ costo: 10, precio: 10 }), true)
    assert.equal(productoSinMargen({ costo: 10, precio: 12 }), false)
    assert.equal(productoSinMargen({ costo: 10, precio: null }), true)
    assert.equal(productoSinMargen({ costo: null, precio: 10 }), false)
  })

  it('margen efectivo: producto → categoría → 20 %', () => {
    assert.equal(margenEfectivoProducto({ margen_pct: 15, categoria: 'CCTV' }), 15)
    assert.equal(
      margenEfectivoProducto(
        { margen_pct: null, categoria: 'CCTV' },
        { margenPorCategoria: { CCTV: 25 } },
      ),
      25,
    )
    assert.equal(margenEfectivoProducto({ margen_pct: null, categoria: 'X' }), 20)
    assert.equal(acotarMargenPct(-5), 0)
    assert.equal(acotarMargenPct(1000), 300)
  })
})
