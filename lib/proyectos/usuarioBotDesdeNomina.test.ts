import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import { actualizarFilaNominaProyecto, crearFilaNominaProyecto } from './proyectoNomina'

const OBRA = '11111111-1111-4111-8111-111111111111'

describe('usuario del bot desde la nómina', () => {
  it('el ingeniero con Telegram queda como Solicitante; un administrador no baja de rol', async () => {
    const sb = crearFakeSupabase({
      ci_proyecto_nomina: [],
      ci_telegram_whitelist: [],
      ci_usuarios_sistema_telegram: [{ id: 'u1', telegram_id: 777, rol: 'Administrador', nombre: 'Jefe', activo: true }],
    })
    const c = sb as unknown as SupabaseClient
    await crearFilaNominaProyecto(c, OBRA, { categoria: 'empleado', rol: 'ingeniero_residente', nombre: 'Ing. Ruiz', telegram_chat_id: 555 })
    await crearFilaNominaProyecto(c, OBRA, { categoria: 'empleado', rol: 'ingeniero_residente', nombre: 'Jefe', telegram_chat_id: 777 })
    const dep = await crearFilaNominaProyecto(c, OBRA, { categoria: 'empleado', rol: 'depositario', nombre: 'Pedro' })
    await actualizarFilaNominaProyecto(c, OBRA, dep.id, { telegram_chat_id: 888 })

    const usuarios = sb.tablas.ci_usuarios_sistema_telegram
    assert.equal(usuarios.find((u: Record<string, unknown>) => u.telegram_id === 555)?.rol, 'Solicitante')
    assert.equal(usuarios.find((u: Record<string, unknown>) => u.telegram_id === 777)?.rol, 'Administrador')
    assert.equal(usuarios.some((u: Record<string, unknown>) => u.telegram_id === 888), false, 'el depositario no usa /procura')
  })
})
