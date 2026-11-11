import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AVISO_FACTURA_NO_CARGADA,
  AVISO_FALTA_PARTE,
  AVISO_FOTO_ILEGIBLE,
  clasificarErrorCargaFactura,
  esErrorValidacionSinAvisoCargador,
  textoAvisoErrorCarga,
} from './avisoErrorCargaFactura'

describe('textoAvisoErrorCarga', () => {
  it('usa los textos cortos pedidos para el comprador', () => {
    assert.equal(textoAvisoErrorCarga('general'), AVISO_FACTURA_NO_CARGADA)
    assert.equal(textoAvisoErrorCarga('falta_parte'), AVISO_FALTA_PARTE)
    assert.match(textoAvisoErrorCarga('ilegible'), /Foto ilegible/)
    assert.match(textoAvisoErrorCarga('ilegible'), /Archivo o en varias fotos/)
    assert.equal(AVISO_FOTO_ILEGIBLE.split('\n').length, 2)
  })
})

describe('clasificarErrorCargaFactura', () => {
  it('marca ilegible cuando la IA no lee el documento', () => {
    assert.equal(
      clasificarErrorCargaFactura('La IA no devolvió datos del documento.'),
      'ilegible',
    )
    assert.equal(
      clasificarErrorCargaFactura(
        new Error('No se pudieron leer datos del documento. Use una foto más nítida.'),
      ),
      'ilegible',
    )
  })

  it('marca falta de parte cuando el álbum no cuadra', () => {
    assert.equal(
      clasificarErrorCargaFactura('Falta una parte de la factura (totales no cuadran).'),
      'falta_parte',
    )
  })

  it('el resto (fetch failed, storage, etc.) es aviso general', () => {
    assert.equal(clasificarErrorCargaFactura('fetch failed'), 'general')
    assert.equal(clasificarErrorCargaFactura(new Error('TypeError: fetch failed')), 'general')
    assert.equal(clasificarErrorCargaFactura('No se pudo descargar el archivo de Telegram'), 'general')
  })
})

describe('esErrorValidacionSinAvisoCargador', () => {
  it('no avisa al comprador por validación de formulario o fecha', () => {
    assert.equal(esErrorValidacionSinAvisoCargador('Seleccione un proyecto.'), true)
    assert.equal(esErrorValidacionSinAvisoCargador(new Error('Fecha anómala: confirme')), true)
    assert.equal(esErrorValidacionSinAvisoCargador('fetch failed'), false)
  })
})
