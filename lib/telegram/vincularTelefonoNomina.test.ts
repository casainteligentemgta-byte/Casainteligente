import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from './testing/fakeSupabase'
import { TELEGRAM_BOT_COMMANDS_COMPRADOR, TELEGRAM_BOT_COMMANDS_DEPOSITARIO } from './botCommands'
import { publicarMenuNativoTrasVinculo } from './menuDepositarioTelegram'
import { claveTelefono, mensajeResultadoVinculo, vincularChatPorTelefono } from './vincularTelefonoNomina'

const OBRA = '11111111-1111-4111-8111-111111111111'

function db() {
  return crearFakeSupabase({
    ci_proyecto_nomina: [
      { id: 'n1', proyecto_id: OBRA, rol: 'depositario', nombre: 'Pedro', activo: true, telegram_chat_id: null, telegram_telefono: '0414-1234567', ci_proyectos: { nombre: 'RANCHO' }, categoria: 'empleado' },
      { id: 'n2', proyecto_id: OBRA, rol: 'logistica', nombre: 'Juan', activo: true, telegram_chat_id: 999, telegram_telefono: '0424-7654321', ci_proyectos: { nombre: 'RANCHO' }, categoria: 'empleado' },
      { id: 'n3', proyecto_id: OBRA, rol: 'comprador', nombre: 'Ana', activo: true, telegram_chat_id: null, telegram_telefono: '0412-1112233', ci_proyectos: { nombre: 'RANCHO' }, categoria: 'empleado' },
    ],
    ci_usuarios_sistema_telegram: [],
    ci_telegram_whitelist: [],
  })
}

function capturarSetMyCommands() {
  const llamadas: Array<{ method: string; body: Record<string, unknown> }> = []
  const telegramCall = async (method: string, body: Record<string, unknown>) => {
    llamadas.push({ method, body })
    return true
  }
  return { llamadas, telegramCall }
}

describe('vínculo por teléfono', () => {
  it('normaliza formatos venezolanos', () => {
    assert.equal(claveTelefono('0414-1234567'), '4141234567')
    assert.equal(claveTelefono('+58 414 123 4567'), '4141234567')
    assert.equal(claveTelefono('584141234567'), '4141234567')
    assert.equal(claveTelefono('12345'), null)
  })

  it('vincula el chat del dueño del número y lo autoriza', async () => {
    const sb = db()
    const r = await vincularChatPorTelefono(sb as unknown as SupabaseClient, {
      chatId: '555',
      fromId: 555,
      contacto: { phone_number: '584141234567', user_id: 555 },
    })
    assert.equal(r.estado, 'vinculado')
    const fila = sb.tablas.ci_proyecto_nomina.find((f: Record<string, unknown>) => f.id === 'n1')
    assert.equal(Number(fila.telegram_chat_id), 555)
    assert.equal(sb.tablas.ci_telegram_whitelist.length, 1)
    assert.match(mensajeResultadoVinculo(r), /Depositario · RANCHO/)
    assert.match(mensajeResultadoVinculo(r), /\/start/)
    assert.match(mensajeResultadoVinculo(r), /\/factura/)
    assert.match(mensajeResultadoVinculo(r), /\/ingreso/)
  })

  it('rechaza contactos ajenos, números desconocidos y números ya vinculados a otro chat', async () => {
    const sb = db() as unknown as SupabaseClient
    assert.equal((await vincularChatPorTelefono(sb, { chatId: '555', fromId: 555, contacto: { phone_number: '04141234567', user_id: 777 } })).estado, 'no_es_propio')
    assert.equal((await vincularChatPorTelefono(sb, { chatId: '555', fromId: 555, contacto: { phone_number: '04161112233', user_id: 555 } })).estado, 'no_encontrado')
    assert.equal((await vincularChatPorTelefono(sb, { chatId: '555', fromId: 555, contacto: { phone_number: '04247654321', user_id: 555 } })).estado, 'otro_chat')
  })

  it('tras vincular un depositario publica setMyCommands con scope chat y comandos del depositario', async () => {
    const sb = db()
    const r = await vincularChatPorTelefono(sb as unknown as SupabaseClient, {
      chatId: '555',
      fromId: 555,
      contacto: { phone_number: '584141234567', user_id: 555 },
    })
    assert.equal(r.estado, 'vinculado')
    const { llamadas, telegramCall } = capturarSetMyCommands()
    await publicarMenuNativoTrasVinculo(sb as unknown as SupabaseClient, '555', r, telegramCall)
    assert.equal(llamadas.length, 1)
    assert.equal(llamadas[0].method, 'setMyCommands')
    assert.deepEqual(llamadas[0].body.scope, { type: 'chat', chat_id: 555 })
    assert.deepEqual(llamadas[0].body.commands, TELEGRAM_BOT_COMMANDS_DEPOSITARIO)
    const nombres = (llamadas[0].body.commands as Array<{ command: string }>).map((c) => c.command)
    for (const c of ['menu', 'agenda', 'tecnico', 'bitacora']) {
      assert.ok(!nombres.includes(c), c)
    }
  })

  it('si el depositario ya estaba vinculado, vuelve a publicar su menú nativo', async () => {
    const sb = db()
    const params = {
      chatId: '555',
      fromId: 555,
      contacto: { phone_number: '584141234567', user_id: 555 },
    }
    await vincularChatPorTelefono(sb as unknown as SupabaseClient, params)
    const r = await vincularChatPorTelefono(sb as unknown as SupabaseClient, params)
    assert.equal(r.estado, 'ya_vinculado')
    const { llamadas, telegramCall } = capturarSetMyCommands()
    await publicarMenuNativoTrasVinculo(sb as unknown as SupabaseClient, '555', r, telegramCall)
    assert.equal(llamadas[0]?.method, 'setMyCommands')
    assert.deepEqual(llamadas[0].body.scope, { type: 'chat', chat_id: 555 })
    assert.deepEqual(llamadas[0].body.commands, TELEGRAM_BOT_COMMANDS_DEPOSITARIO)
  })

  it('tras vincular un comprador publica el menú nativo del comprador', async () => {
    const sb = db()
    const r = await vincularChatPorTelefono(sb as unknown as SupabaseClient, {
      chatId: '777',
      fromId: 777,
      contacto: { phone_number: '584121112233', user_id: 777 },
    })
    assert.equal(r.estado, 'vinculado')
    assert.match(mensajeResultadoVinculo(r), /\/start/)
    assert.match(mensajeResultadoVinculo(r), /\/facturas/)
    const { llamadas, telegramCall } = capturarSetMyCommands()
    await publicarMenuNativoTrasVinculo(sb as unknown as SupabaseClient, '777', r, telegramCall)
    assert.equal(llamadas[0]?.method, 'setMyCommands')
    assert.deepEqual(llamadas[0].body.scope, { type: 'chat', chat_id: 777 })
    assert.deepEqual(llamadas[0].body.commands, TELEGRAM_BOT_COMMANDS_COMPRADOR)
  })

  it('no publica menú nativo si el número no está en la nómina', async () => {
    const sb = db() as unknown as SupabaseClient
    const r = await vincularChatPorTelefono(sb, {
      chatId: '555',
      fromId: 555,
      contacto: { phone_number: '04161112233', user_id: 555 },
    })
    assert.equal(r.estado, 'no_encontrado')
    const { llamadas, telegramCall } = capturarSetMyCommands()
    await publicarMenuNativoTrasVinculo(sb, '555', r, telegramCall)
    assert.equal(llamadas.length, 0)
  })
})
