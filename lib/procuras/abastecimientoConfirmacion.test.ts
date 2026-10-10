import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cantidadCompraPendienteDeOrdenar,
  etiquetaResultadoAbastecimiento,
} from './abastecimientoProcuraAprobada'
import { mensajeAvisoAlmacenRetiro } from '../telegram/retiroCompraTelegram'

describe('al confirmar el almacén no se repite la orden de compra', () => {
  it('lo pedido al aprobar no se vuelve a pedir', () => {
    assert.equal(cantidadCompraPendienteDeOrdenar(50, 50), 0)
    assert.equal(cantidadCompraPendienteDeOrdenar(30, 50), 0)
  })

  it('si el almacén tenía menos de lo previsto, solo se pide la diferencia', () => {
    assert.equal(cantidadCompraPendienteDeOrdenar(90, 50), 40)
  })

  it('sin orden previa se pide todo lo que falta', () => {
    assert.equal(cantidadCompraPendienteDeOrdenar(50, 0), 50)
    assert.equal(cantidadCompraPendienteDeOrdenar(50, Number.NaN), 50)
  })

  it('el depositario lee que la orden ya se había enviado, no «sin comprador»', () => {
    const texto = etiquetaResultadoAbastecimiento({
      ok: true,
      estado: 'recibida_parcial',
      despachoCodigo: 'SAL-1',
      compraEmitida: true,
      compraYaOrdenada: true,
      modo: 'ejecutado',
    })
    assert.match(texto, /Despacho SAL-1/)
    assert.match(texto, /ya se había enviado al comprador/)
    assert.doesNotMatch(texto, /sin comprador/)
  })

  it('un segundo toque avisa que ya estaba confirmado', () => {
    const texto = etiquetaResultadoAbastecimiento({
      ok: true,
      despachoCodigo: 'SAL-1',
      yaConfirmado: true,
      modo: 'ejecutado',
    })
    assert.match(texto, /ya estaba confirmado \(SAL-1\)/)
  })
})

describe('retiro de la compra: aviso al almacén', () => {
  it('solo dice que el almacén fue avisado si le llegó a alguien', () => {
    assert.match(mensajeAvisoAlmacenRetiro(1), /ya fue avisado/)
    assert.match(mensajeAvisoAlmacenRetiro(0), /avise usted/)
    assert.doesNotMatch(mensajeAvisoAlmacenRetiro(0), /ya fue avisado/)
  })

  it('si quien retira es el propio almacén, le recuerda registrar el ingreso', () => {
    assert.match(mensajeAvisoAlmacenRetiro(0, true), /\/ingreso/)
    assert.doesNotMatch(mensajeAvisoAlmacenRetiro(0, true), /avise usted/)
  })
})
