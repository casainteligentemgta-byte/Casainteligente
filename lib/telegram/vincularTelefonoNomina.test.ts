import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from './testing/fakeSupabase'
import { claveTelefono, mensajeResultadoVinculo, vincularChatPorTelefono } from './vincularTelefonoNomina'

const OBRA = '11111111-1111-4111-8111-111111111111'

function db() {
  return crearFakeSupabase({
    ci_proyecto_nomina: [
      { id: 'n1', proyecto_id: OBRA, rol: 'depositario', nombre: 'Pedro', activo: true, telegram_chat_id: null, telegram_telefono: '0414-1234567', ci_proyectos: { nombre: 'RANCHO' }, categoria: 'empleado' },
      { id: 'n2', proyecto_id: OBRA, rol: 'logistica', nombre: 'Juan', activo: true, telegram_chat_id: 999, telegram_telefono: '0424-7654321', ci_proyectos: { nombre: 'RANCHO' }, categoria: 'empleado' },
    ],
    ci_telegram_whitelist: [],
  })
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
  })

  it('rechaza contactos ajenos, números desconocidos y números ya vinculados a otro chat', async () => {
    const sb = db() as unknown as SupabaseClient
    assert.equal((await vincularChatPorTelefono(sb, { chatId: '555', fromId: 555, contacto: { phone_number: '04141234567', user_id: 777 } })).estado, 'no_es_propio')
    assert.equal((await vincularChatPorTelefono(sb, { chatId: '555', fromId: 555, contacto: { phone_number: '04161112233', user_id: 555 } })).estado, 'no_encontrado')
    assert.equal((await vincularChatPorTelefono(sb, { chatId: '555', fromId: 555, contacto: { phone_number: '04247654321', user_id: 555 } })).estado, 'otro_chat')
  })
})
