import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseExtractedPurchaseInvoice } from './extractPurchaseInvoiceGemini'
import { filtrarLineasOcrConCantidad } from './filtrarLineasOcrIngreso'

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

  it('no inventa cantidad 1 si la fila no trae quantity', () => {
    const r = parseExtractedPurchaseInvoice(
      JSON.stringify({
        invoice_number: '000480',
        supplier_rif: 'J-1',
        supplier_name: '2M VENEZUELA',
        date: '2026-11-17',
        items: [{ description: 'BLOQUES', item_code: '', unit: 'M3', unit_price: 0 }],
      }),
    )
    assert.equal(r.items[0].quantity, 0)
    assert.equal(filtrarLineasOcrConCantidad(r.items).length, 0)
  })

  it('conserva las dos cantidades de cemento (4 pallet y 1/2 saco)', () => {
    const r = parseExtractedPurchaseInvoice(
      JSON.stringify({
        invoice_number: '000480',
        supplier_rif: 'J-1',
        supplier_name: '2M VENEZUELA',
        date: '2026-11-17',
        items: [
          {
            description: 'CEMENTO',
            item_code: '',
            unit: '',
            quantity: 4,
            unit_price: 0,
            quantity_present: true,
            quantity_raw: '4 pallet y 1/2 saco',
            quantity_parts: [
              { quantity: 4, unit: 'PALLET', label: '4 pallet' },
              { quantity: 0.5, unit: 'SACO', label: '1/2 saco' },
            ],
          },
        ],
      }),
    )
    assert.equal(r.items[0].quantity, 4)
    assert.equal(r.items[0].quantity_parts?.length, 2)
    const filtradas = filtrarLineasOcrConCantidad(r.items)
    assert.equal(filtradas.length, 1)
    assert.equal(filtradas[0].cantidades.length, 2)
  })
})
