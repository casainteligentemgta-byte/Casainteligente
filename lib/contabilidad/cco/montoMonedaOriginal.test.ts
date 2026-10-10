import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  montoEnMonedaOriginal,
  resolverMontosCompraBimonetario,
} from '../comprasBimonetario'

const TASA = 100

describe('factura en dólares: el monto en bolívares no se convierte dos veces', () => {
  it('una factura de 125 USD queda en 12.500 Bs al pasar por los dos registros', async () => {
    const factura = await resolverMontosCompraBimonetario({
      montoTotal: 125,
      moneda: 'USD',
      fecha: '2026-10-10',
      tasaBcvDigitada: TASA,
    })
    assert.equal(factura.montoUsd, 125)
    assert.equal(factura.montoVes, 12_500)
    assert.equal(montoEnMonedaOriginal(factura), 125)

    // Así llega a Contabilidad: total en la moneda de la factura + la misma tasa.
    const contabilidad = await resolverMontosCompraBimonetario({
      montoTotal: montoEnMonedaOriginal(factura),
      moneda: factura.monedaOriginal,
      fecha: '2026-10-10',
      tasaBcvDigitada: factura.tasaApplied,
    })
    assert.equal(contabilidad.montoUsd, 125)
    assert.equal(contabilidad.montoVes, 12_500)
  })

  it('una factura en bolívares sigue igual', async () => {
    const factura = await resolverMontosCompraBimonetario({
      montoTotal: 12_500,
      moneda: 'VES',
      fecha: '2026-10-10',
      tasaBcvDigitada: TASA,
    })
    assert.equal(montoEnMonedaOriginal(factura), 12_500)
    assert.equal(factura.montoUsd, 125)
  })
})
