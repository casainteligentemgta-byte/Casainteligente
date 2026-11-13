import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseExtractedPurchaseInvoice } from './extractPurchaseInvoiceGemini'

describe('parseExtractedPurchaseInvoice document_kind', () => {
  it('marca nota_entrega cuando la IA lo indica', () => {
    const r = parseExtractedPurchaseInvoice(
      JSON.stringify({
        invoice_number: 'NE-1',
        supplier_rif: 'J-1',
        supplier_name: 'Acme',
        date: '2026-11-01',
        total_amount: 0,
        document_kind: 'nota_entrega',
        items: [{ description: 'Cemento', item_code: '', unit: 'UND', quantity: 2, unit_price: 0 }],
      }),
    )
    assert.equal(r.document_kind, 'nota_entrega')
  })

  it('marca factura cuando la IA lo indica', () => {
    const r = parseExtractedPurchaseInvoice(
      JSON.stringify({
        invoice_number: 'F-1',
        supplier_rif: 'J-1',
        supplier_name: 'Acme',
        date: '2026-11-01',
        total_amount: 10,
        document_kind: 'factura',
        items: [{ description: 'Cemento', item_code: '', unit: 'UND', quantity: 1, unit_price: 10 }],
      }),
    )
    assert.equal(r.document_kind, 'factura')
  })
})
