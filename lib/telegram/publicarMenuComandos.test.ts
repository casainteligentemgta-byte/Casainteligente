import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  comandosMenuCanonico,
  menusComandosIguales,
  normalizarComandosBot,
  publicarMenuComandosTelegram,
  sanitizarTextoConToken,
} from './publicarMenuComandos'
// @ts-ignore -- misma fuente que setMyCommands de los scripts
import { TELEGRAM_BOT_COMMANDS } from '../../scripts/telegram-bot-commands.shared.mjs'

const TOKEN_PRUEBA = '123456:AA-token-de-prueba-no-loguear'

describe('sanitizarTextoConToken', () => {
  it('nunca deja el token en el texto', () => {
    const msg = sanitizarTextoConToken(
      `fetch failed https://api.telegram.org/bot${TOKEN_PRUEBA}/getMyCommands`,
      TOKEN_PRUEBA,
    )
    assert.equal(msg.includes(TOKEN_PRUEBA), false)
    assert.match(msg, /\[redacted\]/)
  })
})

describe('normalizarComandosBot / menusComandosIguales', () => {
  it('normaliza command a minúsculas y recorta espacios', () => {
    assert.deepEqual(
      normalizarComandosBot([{ command: ' Menu ', description: ' Principal ' }]),
      [{ command: 'menu', description: 'Principal' }],
    )
  })

  it('considera distinto un menú con otro orden o descripción', () => {
    const a = [
      { command: 'menu', description: 'A' },
      { command: 'ayuda', description: 'B' },
    ]
    assert.equal(menusComandosIguales(a, a), true)
    assert.equal(
      menusComandosIguales(a, [
        { command: 'ayuda', description: 'B' },
        { command: 'menu', description: 'A' },
      ]),
      false,
    )
    assert.equal(
      menusComandosIguales(a, [
        { command: 'menu', description: 'A' },
        { command: 'ayuda', description: 'otra' },
      ]),
      false,
    )
  })
})

describe('comandosMenuCanonico', () => {
  it('usa TELEGRAM_BOT_COMMANDS del mjs compartido', () => {
    const canon = comandosMenuCanonico()
    assert.ok(canon.length >= 8)
    assert.deepEqual(
      canon.map((c) => c.command),
      TELEGRAM_BOT_COMMANDS.map((c: { command: string }) => c.command),
    )
    for (const c of canon) {
      assert.match(c.command, /^[a-z0-9_]{1,32}$/)
      assert.ok(c.description.length > 0 && c.description.length <= 256)
    }
  })
})

describe('publicarMenuComandosTelegram', () => {
  it('no llama a Telegram si falta el token', async () => {
    const prev = process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_BOT_TOKEN
    try {
      const r = await publicarMenuComandosTelegram({ token: '' })
      assert.equal(r.ok, false)
      if (!r.ok) assert.match(r.error, /TELEGRAM_BOT_TOKEN/)
    } finally {
      if (prev !== undefined) process.env.TELEGRAM_BOT_TOKEN = prev
      else delete process.env.TELEGRAM_BOT_TOKEN
    }
  })

  it('no llama setMyCommands si el menú ya coincide', async () => {
    const llamadas: string[] = []
    const r = await publicarMenuComandosTelegram({
      token: TOKEN_PRUEBA,
      commands: TELEGRAM_BOT_COMMANDS,
      telegramCall: async (method) => {
        llamadas.push(method)
        if (method === 'getMyCommands') return TELEGRAM_BOT_COMMANDS
        throw new Error('setMyCommands no debía ejecutarse')
      },
    })
    assert.deepEqual(llamadas, ['getMyCommands'])
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.actualizado, false)
      assert.equal(r.comandos, TELEGRAM_BOT_COMMANDS.length)
    }
  })

  it('publica setMyCommands solo cuando getMyCommands difiere (scope default)', async () => {
    const llamadas: Array<{ method: string; body: Record<string, unknown> }> = []
    const r = await publicarMenuComandosTelegram({
      token: TOKEN_PRUEBA,
      commands: TELEGRAM_BOT_COMMANDS,
      telegramCall: async (method, body) => {
        llamadas.push({ method, body })
        if (method === 'getMyCommands') return [{ command: 'menu', description: 'viejo' }]
        return true
      },
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.actualizado, true)
    assert.equal(llamadas[0]?.method, 'getMyCommands')
    assert.deepEqual(llamadas[0]?.body, { scope: { type: 'default' } })
    assert.equal(llamadas[1]?.method, 'setMyCommands')
    assert.deepEqual(llamadas[1]?.body.scope, { type: 'default' })
    const publicados = llamadas[1]?.body.commands as Array<{ command: string }>
    assert.deepEqual(
      publicados.map((c) => c.command),
      TELEGRAM_BOT_COMMANDS.map((c: { command: string }) => c.command),
    )
  })

  it('el error no incluye el token aunque Telegram lo ponga en el mensaje', async () => {
    const r = await publicarMenuComandosTelegram({
      token: TOKEN_PRUEBA,
      telegramCall: async () => {
        throw new Error(`Unauthorized: bot${TOKEN_PRUEBA} rejected`)
      },
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.error.includes(TOKEN_PRUEBA), false)
      assert.match(r.error, /\[redacted\]/)
    }
  })
})
