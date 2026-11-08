import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { documentApiPathDesdeCompra, rutaDocumentoPendienteCanal } from './facturaCanalApi'

describe('rutaDocumentoPendienteCanal', () => {
  it('apunta al endpoint que firma la URL del documento', () => {
    assert.equal(
      rutaDocumentoPendienteCanal('11111111-1111-4111-8111-111111111111'),
      '/api/facturas-canal/pendientes/11111111-1111-4111-8111-111111111111/document',
    )
  })
})

describe('documentApiPathDesdeCompra', () => {
  it('usa el endpoint de canal para pendientes sin purchase_invoice_id', () => {
    assert.equal(
      documentApiPathDesdeCompra({
        id: 'canal-11111111-1111-4111-8111-111111111111',
        pendiente_canal_id: '11111111-1111-4111-8111-111111111111',
        purchase_invoice_id: null,
      }),
      '/api/facturas-canal/pendientes/11111111-1111-4111-8111-111111111111/document',
    )
  })

  it('deja el endpoint de compras cuando ya hay purchase_invoice_id y no es canal-', () => {
    assert.equal(
      documentApiPathDesdeCompra({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        pendiente_canal_id: '11111111-1111-4111-8111-111111111111',
        purchase_invoice_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
      undefined,
    )
  })
})
