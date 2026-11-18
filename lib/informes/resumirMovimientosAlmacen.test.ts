import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resumirMovimientosAlmacen } from './resumirMovimientosAlmacen'

const UB = 'ub-almacen'
const MAT = 'mat-yeso'
const DESDE = '2026-11-10T00:00:00.000Z'
const nombres = {
  ubicaciones: { [UB]: 'ALMACÉN – RANCHO FLAMBOYANT' },
  materiales: { [MAT]: { nombre: 'YESO - 25 KG', unidad: 'KG' } },
}
const mov = (d: number, t: number, fecha: string) => ({
  ubicacion_id: UB, material_id: MAT, delta_disponible: d, delta_transito_entrante: t, created_at: fecha,
})

describe('resumirMovimientosAlmacen', () => {
  it('separa entradas y salidas del periodo y deriva la existencia inicial', () => {
    const filas = resumirMovimientosAlmacen({
      movimientos: [
        mov(10, -10, '2026-11-11T09:00:00Z'), // entrada: liberación de tránsito
        mov(-4, 0, '2026-11-12T09:00:00Z'),   // salida
        mov(5, 0, '2026-11-01T09:00:00Z'),    // fuera del periodo: no cuenta
      ],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 6, cantidad_en_transito_entrante: 0 }],
      desdeIso: DESDE,
      nombres,
    })
    assert.equal(filas.length, 1)
    const f = filas[0]
    assert.equal(f.entradas, 10)
    assert.equal(f.salidas, 4)
    assert.equal(f.existenciaActual, 6)
    // inicial = actual − neto del periodo (10 − 4 = 6) → 0
    assert.equal(f.existenciaInicial, 0)
    assert.equal(f.ubicacion, 'ALMACÉN – RANCHO FLAMBOYANT')
    assert.equal(f.unidad, 'KG')
  })

  it('muestra el tránsito pendiente aunque no haya movimientos en el periodo', () => {
    const filas = resumirMovimientosAlmacen({
      movimientos: [],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 0, cantidad_en_transito_entrante: 24 }],
      desdeIso: DESDE,
      nombres,
    })
    assert.equal(filas.length, 1)
    assert.equal(filas[0].enTransito, 24)
    assert.equal(filas[0].entradas, 0)
  })

  it('omite combinaciones sin movimiento, sin existencia ni tránsito', () => {
    const filas = resumirMovimientosAlmacen({
      movimientos: [],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 0, cantidad_en_transito_entrante: 0 }],
      desdeIso: DESDE,
      nombres,
    })
    assert.equal(filas.length, 0)
  })
})
