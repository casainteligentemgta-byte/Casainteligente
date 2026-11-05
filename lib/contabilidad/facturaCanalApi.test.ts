import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rutaDocumentoPendienteCanal } from './facturaCanalApi'

describe('rutaDocumentoPendienteCanal', () => {
  it('apunta al endpoint que firma la URL del documento', () => {
    assert.equal(
      rutaDocumentoPendienteCanal('11111111-1111-4111-8111-111111111111'),
      '/api/facturas-canal/pendientes/11111111-1111-4111-8111-111111111111/document',
    )
  })
})
