import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bloqueFondosProcura } from './fondosObraProcura'
import { construirMensajeAdminViabilidadProcura } from './mensajeAlertaProcuraTelegram'

const fondos = { ingresosUsd: 717015, costoTotalUsd: 700000, saldoCajaUsd: 17015 }

describe('fondos del cliente en el ticket del Contador', () => {
  it('muestra recibido, gastado y saldo en caja', () => {
    const b = bloqueFondosProcura(fondos, null)
    assert.match(b, /Fondos del cliente \(CCO\)/)
    assert.match(b, /Recibido: USD 717\.015,00/)
    assert.match(b, /Gastado con honorarios: USD 700\.000,00/)
    assert.match(b, /Saldo en caja: <b>USD 17\.015,00<\/b>/)
    assert.doesNotMatch(b, /⚠️|✅/)
  })

  it('avisa cuando el estimado supera el saldo', () => {
    assert.match(bloqueFondosProcura(fondos, 20000), /⚠️ <b>La compra estimada \(USD 20\.000,00\) supera el saldo/)
  })

  it('dice que alcanza cuando el saldo cubre el estimado', () => {
    assert.match(bloqueFondosProcura(fondos, 500), /✅ El saldo cubre el estimado/)
  })

  it('avisa cuando la obra está sin saldo, haya o no estimado', () => {
    const sinSaldo = { ingresosUsd: 1000, costoTotalUsd: 1200, saldoCajaUsd: -200 }
    assert.match(bloqueFondosProcura(sinSaldo, null), /no tiene saldo en caja/)
    assert.match(bloqueFondosProcura(sinSaldo, 50), /no tiene saldo en caja/)
  })

  it('sin datos de fondos no agrega nada', () => {
    assert.equal(bloqueFondosProcura(null, 500), '')
  })

  it('el ticket del Contador incluye el bloque antes de la pregunta', () => {
    const row = {
      id: 'p1',
      ticket: 'PR-2026-00100',
      estado: 'solicitada',
      solicitante_nombre: 'Ing. Pérez',
      material_txt: 'Cemento gris',
      cantidad: 10,
      unidad: 'SACO',
      monto_estimado_usd: 20000,
    } as Parameters<typeof construirMensajeAdminViabilidadProcura>[0]
    const conFondos = construirMensajeAdminViabilidadProcura(row, 'Alta', null, fondos)
    assert.ok(conFondos.indexOf('Saldo en caja') < conFondos.indexOf('¿Hay <b>disponibilidad'))
    assert.match(conFondos, /supera el saldo en caja/)

    const sinFondos = construirMensajeAdminViabilidadProcura(row, 'Alta', null)
    assert.doesNotMatch(sinFondos, /Fondos del cliente/)
  })
})
