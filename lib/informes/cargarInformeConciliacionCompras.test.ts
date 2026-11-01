import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { conciliarCompras } from './cargarInformeConciliacionCompras'

const F1 = 'factura-existe'
const BORRADA = 'factura-borrada'
const UB = 'ub-obra'
const MAT = 'mat-arena'

const factura = { id: F1, ubicacion_id: UB, numero: 'FA-1', proveedor: 'Proveedor' }
const mov = (doc: string | null, disp: number, tr: number) => ({
  documento_id: doc,
  ubicacion_id: UB,
  material_id: MAT,
  delta_disponible: disp,
  delta_transito_entrante: tr,
})

describe('conciliarCompras', () => {
  it('factura borrada con tránsito en el ledger (caso Arena Fina)', () => {
    const r = conciliarCompras({
      facturas: [factura],
      inspecciones: [],
      movimientos: [mov(BORRADA, 0, 16)],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 0, cantidad_en_transito_entrante: 0 }],
    })
    const fila = r.filas[0]
    assert.equal(fila.estado, 'factura_borrada')
    assert.equal(fila.facturaExiste, false)
    assert.equal(fila.transitoLedger, 16)
    assert.match(fila.alertas[0], /Factura borrada/)
    assert.equal(r.resumen.facturasBorradas, 1)
    assert.equal(r.resumen.transitoHuerfano, 16)
    // El stock dice 0 en tránsito, el ledger dice 16: descuadre.
    assert.equal(r.cuadreStock.length, 1)
    assert.equal(r.cuadreStock[0].ledgerTransito, 16)
    assert.equal(r.cuadreStock[0].stockTransito, 0)
  })

  it('factura recibida completa y ledger igual a lo aprobado no genera alertas', () => {
    const r = conciliarCompras({
      facturas: [factura],
      inspecciones: [{ invoice_id: F1, material_id: MAT, quantity: 10, status: 'APROBADO', ubicacion_id: UB }],
      movimientos: [mov(F1, 10, 0)],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 10, cantidad_en_transito_entrante: 0 }],
    })
    assert.equal(r.filas[0].estado, 'recibido')
    assert.deepEqual(r.filas[0].alertas, [])
    assert.equal(r.resumen.filasConAlerta, 0)
    assert.equal(r.cuadreStock.length, 0)
  })

  it('en cuarentena con tránsito respaldado por pendiente no es alerta', () => {
    const r = conciliarCompras({
      facturas: [factura],
      inspecciones: [{ invoice_id: F1, material_id: MAT, quantity: 5, status: 'PENDIENTE', ubicacion_id: UB }],
      movimientos: [mov(F1, 0, 5)],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 0, cantidad_en_transito_entrante: 5 }],
    })
    assert.equal(r.filas[0].estado, 'en_cuarentena')
    assert.deepEqual(r.filas[0].alertas, [])
  })

  it('tránsito sin cuarentena pendiente se marca como alerta', () => {
    const r = conciliarCompras({
      facturas: [factura],
      inspecciones: [{ invoice_id: F1, material_id: MAT, quantity: 5, status: 'APROBADO', ubicacion_id: UB }],
      movimientos: [mov(F1, 5, 3)],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 5, cantidad_en_transito_entrante: 3 }],
    })
    assert.ok(r.filas[0].alertas.some((a) => /Tránsito sin cuarentena/.test(a)))
  })

  it('lo rechazado no cuenta como disponible ni genera alerta', () => {
    const r = conciliarCompras({
      facturas: [factura],
      inspecciones: [
        { invoice_id: F1, material_id: MAT, quantity: 10, status: 'APROBADO', ubicacion_id: UB },
        { invoice_id: F1, material_id: MAT, quantity: 4, status: 'RECHAZADO', ubicacion_id: UB },
      ],
      movimientos: [mov(F1, 10, 0)],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 10, cantidad_en_transito_entrante: 0 }],
    })
    assert.equal(r.filas[0].rechazado, 4)
    assert.equal(r.filas[0].aprobado, 10)
    assert.deepEqual(r.filas[0].alertas, [])
  })

  it('stock sin movimientos en el ledger se marca como descuadre', () => {
    const r = conciliarCompras({
      facturas: [factura],
      inspecciones: [],
      movimientos: [],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 3, cantidad_en_transito_entrante: 0 }],
    })
    assert.equal(r.cuadreStock.length, 1)
    assert.equal(r.cuadreStock[0].stockDisponible, 3)
    assert.equal(r.cuadreStock[0].ledgerDisponible, 0)
  })

  it('ledger distinto de lo aprobado se marca', () => {
    const r = conciliarCompras({
      facturas: [factura],
      inspecciones: [{ invoice_id: F1, material_id: MAT, quantity: 10, status: 'APROBADO', ubicacion_id: UB }],
      movimientos: [mov(F1, 7, 0)],
      stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 7, cantidad_en_transito_entrante: 0 }],
    })
    assert.ok(r.filas[0].alertas.some((a) => /Ledger ≠ aprobado/.test(a)))
  })
})
