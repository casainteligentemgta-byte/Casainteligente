import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { etiquetaProveedorBoton, nombreCortoProveedor } from './etiquetaProveedorBoton'

describe('etiquetaProveedorBoton', () => {
  it('quita sufijos legales y deja el conteo', () => {
    assert.equal(etiquetaProveedorBoton('FERREMATERIALES EXPRESS, GP, C.A.', 1), '🏢 FERREMATERIALES EXPRESS (1)')
  })

  it('acorta nombres largos con puntos suspensivos', () => {
    const corto = nombreCortoProveedor('FERREMATEIALES GARCÍA PÉREZ, F.P.')
    assert.ok(corto.length <= 24)
    assert.ok(corto.endsWith('…'))
  })

  it('no cambia un nombre corto', () => {
    assert.equal(nombreCortoProveedor('Tomás José'), 'Tomás José')
  })

  it('si solo hay sufijos, conserva el nombre original', () => {
    assert.equal(nombreCortoProveedor('C.A.'), 'C.A.')
  })
})
