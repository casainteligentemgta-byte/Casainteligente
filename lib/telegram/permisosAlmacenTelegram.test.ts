import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  esCallbackCargaFacturaComprador,
  esCallbackMovimientoAlmacenTelegram,
  MENSAJE_CARGA_FACTURA_NO_DEPOSITARIO,
  MENSAJE_EMERGENCIA_NO_COMPRADOR,
} from '@/lib/telegram/permisosAlmacenTelegram'

describe('permisos de almacén en Telegram', () => {
  it('marca como movimiento de almacén los menús del depositario, no la carga del comprador', () => {
    assert.equal(esCallbackMovimientoAlmacenTelegram('sg:merma'), true)
    assert.equal(esCallbackMovimientoAlmacenTelegram('cg:pendientes'), true)
    assert.equal(esCallbackMovimientoAlmacenTelegram('cg:ingreso_sin_nota'), true)
    assert.equal(esCallbackMovimientoAlmacenTelegram('ig:sinnota'), true)
    assert.equal(esCallbackMovimientoAlmacenTelegram('mr:ok'), true)
    assert.equal(esCallbackMovimientoAlmacenTelegram('cg:factura_ia'), false)
    assert.equal(esCallbackMovimientoAlmacenTelegram('cg:factura_manual'), false)
    assert.equal(esCallbackMovimientoAlmacenTelegram('cg:nota'), false)
  })

  it('detecta el flujo de carga de factura del comprador', () => {
    assert.equal(esCallbackCargaFacturaComprador('cg:factura_ia'), true)
    assert.equal(esCallbackCargaFacturaComprador('cg:factura_manual'), true)
    assert.equal(esCallbackCargaFacturaComprador('cg:nota'), true)
    assert.equal(esCallbackCargaFacturaComprador('cg:pendientes'), false)
  })

  it('los avisos son cortos y dicen qué hacer', () => {
    assert.match(MENSAJE_EMERGENCIA_NO_COMPRADOR, /\/facturas/)
    assert.match(MENSAJE_CARGA_FACTURA_NO_DEPOSITARIO, /\/ingreso/)
  })
})
