import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapGeminiError } from './client'

describe('mapGeminiError', () => {
  it('conserva retryable cuando la IA no devolvió texto', () => {
    const original = Object.assign(new Error('La IA no devolvió datos del documento.'), {
      retryable: true,
    })
    const mapped = mapGeminiError(original, 'gemini-2.5-flash')
    assert.equal(mapped.retryable, true)
    assert.equal(mapped.message, 'La IA no devolvió datos del documento.')
  })

  it('marca fetch failed y timeout/504 como reintentables', () => {
    assert.equal(mapGeminiError(new Error('TypeError: fetch failed'), 'm').retryable, true)
    assert.equal(mapGeminiError(new Error('Gateway Timeout'), 'm').retryable, true)
    assert.equal(mapGeminiError(new Error('504'), 'm').retryable, true)
  })

  it('no marca clave inválida como reintentable', () => {
    assert.equal(
      mapGeminiError(new Error('Clave GEMINI_API_KEY inválida o sin permisos.'), 'm')
        .retryable,
      false,
    )
  })
})
