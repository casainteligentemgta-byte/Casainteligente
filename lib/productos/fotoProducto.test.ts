import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { payloadFotoProducto, productoSinFoto, urlFotoProducto } from './fotoProducto'

describe('foto del producto', () => {
  it('usa imagen; image_url solo si imagen está vacía (leftover, no se inventa)', () => {
    assert.equal(urlFotoProducto({ imagen: ' https://a ', image_url: 'https://b' }), 'https://a')
    assert.equal(urlFotoProducto({ imagen: null, image_url: 'https://b' }), 'https://b')
    assert.equal(urlFotoProducto({ imagen: '  ', image_url: '' }), null)
    assert.equal(urlFotoProducto({ imagen: null, image_url: null }), null)
    assert.equal(productoSinFoto({ imagen: null, image_url: '  ' }), true)
    assert.equal(productoSinFoto({ imagen: 'https://a' }), false)
  })

  it('la escritura solo toca imagen', () => {
    assert.deepEqual(payloadFotoProducto(' https://a '), { imagen: 'https://a' })
    assert.deepEqual(payloadFotoProducto(''), { imagen: null })
  })
})
