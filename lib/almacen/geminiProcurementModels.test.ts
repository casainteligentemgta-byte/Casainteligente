import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { esModeloLiteOcr, GEMINI_PROCUREMENT_DEFAULT_MODEL } from './geminiProcurementModels'

describe('esModeloLiteOcr', () => {
  it('el modelo de re-lectura de calidad no es lite', () => {
    assert.equal(esModeloLiteOcr(GEMINI_PROCUREMENT_DEFAULT_MODEL), false)
  })
})
