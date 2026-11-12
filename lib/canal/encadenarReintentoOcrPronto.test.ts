import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESPERA_ENCADENADO_MS,
  dispararReintentoOcrEncadenado,
  encadenarReintentoOcrPronto,
  originAppParaEncadenado,
  urlReintentoOcrEncadenado,
} from './encadenarReintentoOcrPronto'

describe('urlReintentoOcrEncadenado', () => {
  it('apunta a la ruta protegida con el id, sin el secreto', () => {
    const url = urlReintentoOcrEncadenado({
      pendingId: 'pend-1',
      origin: 'https://casainteligente.company',
    })
    assert.equal(
      url,
      'https://casainteligente.company/api/cron/facturas-ocr-reintentos?id=pend-1',
    )
    assert.equal(/secret|Bearer|token/i.test(url), false)
  })

  it('usa VERCEL_URL si no hay URL pública', () => {
    assert.equal(
      originAppParaEncadenado({ VERCEL_URL: 'app.vercel.app' }),
      'https://app.vercel.app',
    )
  })
})

describe('dispararReintentoOcrEncadenado', () => {
  it('POSTea con Bearer y el id; el secreto no va en la URL', async () => {
    const llamadas: Array<{ url: string; init?: RequestInit }> = []
    const r = await dispararReintentoOcrEncadenado({
      pendingId: 'abc',
      origin: 'https://casainteligente.company',
      secret: 'cron-super-secreto',
      fetchImpl: async (url, init) => {
        llamadas.push({ url: String(url), init })
        return new Response('{"ok":true}', { status: 200 })
      },
    })
    assert.equal(r.ok, true)
    assert.equal(llamadas.length, 1)
    assert.equal(
      llamadas[0].url,
      'https://casainteligente.company/api/cron/facturas-ocr-reintentos?id=abc',
    )
    assert.equal(/cron-super-secreto/.test(llamadas[0].url), false)
    const headers = new Headers(llamadas[0].init?.headers)
    assert.equal(headers.get('authorization'), 'Bearer cron-super-secreto')
    assert.equal(String(llamadas[0].init?.body ?? ''), '{"pendingId":"abc"}')
  })
})

describe('encadenarReintentoOcrPronto', () => {
  it('no espera al cron diario: dispara en segundos vía continuar/waitUntil', async () => {
    const sleeps: number[] = []
    const urls: string[] = []
    let registrado: Promise<unknown> | null = null
    encadenarReintentoOcrPronto({
      pendingId: 'p9',
      origin: 'https://casainteligente.company',
      secret: 's',
      esperaMs: ESPERA_ENCADENADO_MS,
      dormir: async (ms) => {
        sleeps.push(ms)
      },
      fetchImpl: async (url) => {
        urls.push(String(url))
        return new Response('{"ok":true}', { status: 200 })
      },
      continuar: (trabajo) => {
        registrado = trabajo
      },
    })
    assert.ok(registrado)
    await registrado!
    assert.deepEqual(sleeps, [2_000])
    assert.equal(urls.length, 1)
    assert.equal(urls[0].includes('facturas-ocr-reintentos?id=p9'), true)
  })
})
