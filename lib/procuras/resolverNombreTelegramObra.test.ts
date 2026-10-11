import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import {
  SELECT_NOMBRE_POR_CHAT,
  resolverNombreMostrarTelegram,
  resolverNombreObraPorChatTelegram,
} from './resolverNombreTelegramObra'

const OBRA = 'obra-1'

function db() {
  return crearFakeSupabase({
    ci_proyecto_nomina: [
      { id: 'n1', proyecto_id: OBRA, empleado_id: null, nombre: 'Neo Cárdenas', rol: 'comprador', telegram_chat_id: 111, activo: true },
      {
        id: 'n2',
        proyecto_id: 'otra-obra',
        empleado_id: 'e2',
        nombre: null,
        rol: 'ingeniero',
        telegram_chat_id: null,
        activo: true,
        ci_empleados: { nombre_completo: 'Ing. Carla Di Matteo', telegram_chat_id: 222 },
      },
    ],
  }) as unknown as SupabaseClient
}

/** Base que responde con error a toda consulta, como cuando falta una columna. */
function baseQueFalla(mensaje: string) {
  const respuesta = { data: null, error: { code: '42703', message: mensaje } }
  const cadena: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit']) cadena[m] = () => cadena
  cadena.maybeSingle = async () => respuesta
  cadena.single = async () => respuesta
  cadena.then = (ok: (v: typeof respuesta) => unknown) => Promise.resolve(respuesta).then(ok)
  return { from: () => cadena } as unknown as SupabaseClient
}

describe('nombre para mostrar de un chat de Telegram', () => {
  it('pide solo columnas que existen (la del chat del empleado está en ci_empleados)', () => {
    assert.equal(SELECT_NOMBRE_POR_CHAT.includes('empleado_telegram_chat_id'), false)
    assert.match(SELECT_NOMBRE_POR_CHAT, /ci_empleados\([^)]*telegram_chat_id/)
  })

  it('encuentra a quien está en la nómina de esa obra', async () => {
    assert.equal(await resolverNombreObraPorChatTelegram(db(), 111, OBRA), 'Neo Cárdenas')
  })

  it('encuentra a quien solo está en la nómina de otra obra, por el chat de su ficha de empleado', async () => {
    assert.equal(await resolverNombreObraPorChatTelegram(db(), 222, OBRA), 'Ing. Carla Di Matteo')
  })

  it('quien no está en ninguna nómina conserva el nombre que ya tenía', async () => {
    assert.equal(await resolverNombreObraPorChatTelegram(db(), 999, OBRA), null)
    assert.equal(await resolverNombreMostrarTelegram(db(), 999, 'Pedro Almacén', OBRA), 'Pedro Almacén')
  })

  it('si la base responde con error no tumba el flujo: usa el nombre que ya tenía', async () => {
    const rota = baseQueFalla('column ci_proyecto_nomina.empleado_telegram_chat_id does not exist')
    assert.equal(await resolverNombreObraPorChatTelegram(rota, 999, OBRA), null)
    assert.equal(await resolverNombreMostrarTelegram(rota, 999, 'Pedro Almacén', OBRA), 'Pedro Almacén')
  })
})
