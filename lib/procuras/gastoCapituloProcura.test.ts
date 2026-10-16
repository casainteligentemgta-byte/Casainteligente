import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bloqueGastoCapitulo, sumarGastoCapitulo } from './gastoCapituloProcura'
import { construirMensajePmDecisionProcura } from './mensajeAlertaProcuraTelegram'

describe('gasto del capítulo en el ticket del PM', () => {
  it('suma compras una vez por factura y lo aprobado sin comprar, sin la procura actual', () => {
    const g = sumarGastoCapitulo(
      [
        { id: 'a', estado: 'en_compra', monto_estimado_usd: 50, purchase_invoice_id: 'f1' },
        { id: 'b', estado: 'en_compra', monto_estimado_usd: 50, purchase_invoice_id: 'f1' },
        { id: 'c', estado: 'aprobada', monto_estimado_usd: 30, purchase_invoice_id: null },
        { id: 'd', estado: 'pendiente_pm', monto_estimado_usd: 99, purchase_invoice_id: null },
        { id: 'yo', estado: 'aprobada', monto_estimado_usd: 500, purchase_invoice_id: null },
      ],
      new Map([['f1', 120]]),
      'yo',
    )
    assert.deepEqual(g, { compradoUsd: 120, compras: 1, aprobadoSinComprarUsd: 30, aprobadasSinComprar: 1 })
  })

  it('arma el bloque y lo incluye en el ticket del PM', () => {
    const gasto = { ambito: 'capitulo' as const, compradoUsd: 120, compras: 1, aprobadoSinComprarUsd: 30, aprobadasSinComprar: 1 }
    const b = bloqueGastoCapitulo(gasto, 50)
    assert.match(b, /Gasto del capítulo en esta obra/)
    assert.match(b, /Comprado: USD 120,00 \(1 factura\)/)
    assert.match(b, /Con esta procura: <b>USD 200,00<\/b>/)
    assert.equal(bloqueGastoCapitulo(null, 50), '')

    const row = {
      id: 'p1', ticket: 'PR-9', estado: 'pendiente_pm', material_txt: 'Cemento', cantidad: 10, unidad: 'SACO',
      monto_estimado_usd: 50, viabilidad_presupuestaria: 'si',
    } as Parameters<typeof construirMensajePmDecisionProcura>[0]
    const msg = construirMensajePmDecisionProcura(row, 'Alta', null, 'contador', gasto)
    assert.ok(msg.indexOf('Gasto del capítulo') < msg.indexOf('¿Aprueba'))
  })
})
