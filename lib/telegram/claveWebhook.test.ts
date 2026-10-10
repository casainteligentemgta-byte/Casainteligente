import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  claveWebhookAceptada,
  claveWebhookDerivada,
  claveWebhookEsperada,
  claveWebhookObligatoria,
  evaluarClaveWebhook,
  validarClaveWebhook,
} from './claveWebhook'
// @ts-ignore -- módulo .mjs de los scripts, sin tipos
import { claveWebhook as claveWebhookScripts } from '../../scripts/clave-webhook.shared.mjs'

const TOKEN = '123456:ABC-token-de-prueba'
const ENV = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_LOG_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_LOG_WEBHOOK_SECRET', 'TELEGRAM_WEBHOOK_CLAVE_OBLIGATORIA']

function pedido(clave?: string): Request {
  return new Request('https://ejemplo.invalid/api/webhooks/telegram', {
    method: 'POST',
    headers: clave ? { 'x-telegram-bot-api-secret-token': clave } : {},
  })
}

describe('clave del webhook de Telegram', () => {
  afterEach(() => {
    for (const k of ENV) delete process.env[k]
  })

  it('la clave calculada sirve para Telegram y no revela el token', () => {
    const clave = claveWebhookDerivada(TOKEN, 'bot')
    assert.match(clave, /^[a-f0-9]{64}$/)
    assert.ok(!clave.includes('ABC'))
    assert.equal(clave, claveWebhookDerivada(TOKEN, 'bot'))
  })

  it('cada bot tiene su propia clave', () => {
    assert.notEqual(claveWebhookDerivada(TOKEN, 'bot'), claveWebhookDerivada(TOKEN, 'registro'))
    assert.notEqual(claveWebhookDerivada(TOKEN, 'bot'), claveWebhookDerivada(`${TOKEN}x`, 'bot'))
  })

  it('los scripts de mantenimiento calculan la misma clave que el servidor', () => {
    assert.equal(claveWebhookScripts(TOKEN, 'bot'), claveWebhookDerivada(TOKEN, 'bot'))
    assert.equal(claveWebhookScripts(TOKEN, 'registro'), claveWebhookDerivada(TOKEN, 'registro'))
    assert.equal(claveWebhookScripts(TOKEN, 'bot', ' fija '), 'fija')
  })

  it('una clave fija definida a mano manda sobre la calculada', () => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN
    assert.equal(claveWebhookEsperada('bot'), claveWebhookDerivada(TOKEN, 'bot'))
    process.env.TELEGRAM_WEBHOOK_SECRET = 'clave-fija'
    assert.equal(claveWebhookEsperada('bot'), 'clave-fija')
    assert.equal(claveWebhookEsperada('registro'), null)
  })

  it('mientras no sea obligatoria, un aviso sin clave pasa', () => {
    const r = evaluarClaveWebhook({ recibida: null, esperada: 'abc', obligatoria: false })
    assert.equal(r, 'ausente_permitida')
    assert.equal(claveWebhookAceptada(r), true)
  })

  it('siendo obligatoria, un aviso sin clave se rechaza', () => {
    const r = evaluarClaveWebhook({ recibida: '', esperada: 'abc', obligatoria: true })
    assert.equal(r, 'ausente_rechazada')
    assert.equal(claveWebhookAceptada(r), false)
  })

  it('una clave equivocada se rechaza siempre, sea o no obligatoria', () => {
    for (const obligatoria of [true, false]) {
      const r = evaluarClaveWebhook({ recibida: 'otra', esperada: 'abc', obligatoria })
      assert.equal(r, 'invalida')
      assert.equal(claveWebhookAceptada(r), false)
    }
    assert.equal(evaluarClaveWebhook({ recibida: 'abc', esperada: null, obligatoria: false }), 'invalida')
  })

  it('la clave correcta pasa', () => {
    assert.equal(evaluarClaveWebhook({ recibida: 'abc', esperada: 'abc', obligatoria: true }), 'valida')
  })

  it('se vuelve obligatoria con TELEGRAM_WEBHOOK_CLAVE_OBLIGATORIA=1', () => {
    assert.equal(claveWebhookObligatoria('bot'), false)
    process.env.TELEGRAM_WEBHOOK_CLAVE_OBLIGATORIA = '1'
    assert.equal(claveWebhookObligatoria('bot'), true)
    assert.equal(claveWebhookObligatoria('registro'), true)
  })

  it('con el pedido completo: Telegram pasa, un impostor no', () => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN
    process.env.TELEGRAM_LOG_BOT_TOKEN = `${TOKEN}-registro`
    process.env.TELEGRAM_WEBHOOK_CLAVE_OBLIGATORIA = '1'
    assert.equal(validarClaveWebhook(pedido(claveWebhookDerivada(TOKEN, 'bot')), 'bot'), 'valida')
    assert.equal(validarClaveWebhook(pedido(), 'bot'), 'ausente_rechazada')
    assert.equal(validarClaveWebhook(pedido('adivinada'), 'bot'), 'invalida')
    // La clave del bot operativo no sirve para el bot de registro.
    assert.equal(validarClaveWebhook(pedido(claveWebhookDerivada(TOKEN, 'bot')), 'registro'), 'invalida')
    assert.equal(
      validarClaveWebhook(pedido(claveWebhookDerivada(`${TOKEN}-registro`, 'registro')), 'registro'),
      'valida',
    )
  })
})
