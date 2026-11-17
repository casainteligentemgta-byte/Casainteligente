import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PROMPT_ALBUM_PARTES, promptExtraccionConHint } from './extractPurchaseInvoicePrompt'

describe('promptExtraccionConHint', () => {
  it('indica partes solapadas de la misma factura cuando es un álbum', () => {
    const p = promptExtraccionConHint(null, true)
    assert.match(p, /PARTES SOLAPADAS/)
    assert.match(p, /UNA sola vez/)
    assert.ok(p.includes(PROMPT_ALBUM_PARTES.trim().slice(0, 20)))
  })

  it('no menciona el álbum en una foto sola', () => {
    const p = promptExtraccionConHint(null, false)
    assert.equal(p.includes('PARTES SOLAPADAS'), false)
  })

  it('pide a la IA marcar nota de entrega', () => {
    const p = promptExtraccionConHint(null, false)
    assert.match(p, /document_kind/)
    assert.match(p, /nota_entrega/)
  })

  it('ignora renglones preimpresos sin cantidad, no copia unidades del encabezado y lee cantidades compuestas', () => {
    const p = promptExtraccionConHint(null, false)
    assert.match(p, /IGNORA renglones preimpresos/)
    assert.match(p, /NO copies la unidad del ENCABEZADO/)
    assert.match(p, /Cantidades COMPUESTAS/)
    assert.match(p, /rotada/)
    assert.match(p, /quantity_parts/)
    assert.doesNotMatch(p, /usa 1 si no aparece/)
  })
})
