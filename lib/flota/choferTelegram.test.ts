import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { callbackPermitidoChofer, esChatChofer } from './choferTelegram'

type FilaFlota = { telegram_chat_id: number; activo: boolean }

/** Fake mínimo de `from('ci_flota_conductores').select().eq().eq().limit()`. */
function supabaseConFlota(filas: FilaFlota[], fallo = false): SupabaseClient {
  return {
    from() {
      const filtros: Array<[keyof FilaFlota, unknown]> = []
      const builder = {
        select() {
          return builder
        },
        eq(columna: keyof FilaFlota, valor: unknown) {
          filtros.push([columna, valor])
          return builder
        },
        limit() {
          if (fallo) return Promise.resolve({ data: null, error: { message: 'boom' } })
          const data = filas.filter((f) => filtros.every(([c, v]) => f[c] === v))
          return Promise.resolve({ data, error: null })
        },
      }
      return builder
    },
  } as unknown as SupabaseClient
}

describe('esChatChofer', () => {
  it('es chofer si tiene un conductor activo con ese chat', async () => {
    const db = supabaseConFlota([{ telegram_chat_id: 555, activo: true }])
    assert.equal(await esChatChofer(db, '555'), true)
  })

  it('no es chofer si el conductor está inactivo', async () => {
    const db = supabaseConFlota([{ telegram_chat_id: 555, activo: false }])
    assert.equal(await esChatChofer(db, '555'), false)
  })

  it('no es chofer si el chat no está en la flota', async () => {
    const db = supabaseConFlota([{ telegram_chat_id: 555, activo: true }])
    assert.equal(await esChatChofer(db, '999'), false)
  })

  it('ante error de consulta niega el acceso', async () => {
    const db = supabaseConFlota([{ telegram_chat_id: 555, activo: true }], true)
    assert.equal(await esChatChofer(db, '555'), false)
  })
})

describe('callbackPermitidoChofer', () => {
  it('permite factura por foto y nota del menú de carga', () => {
    assert.equal(callbackPermitidoChofer('cg:factura_ia'), true)
    assert.equal(callbackPermitidoChofer('cg:nota'), true)
  })

  it('bloquea el resto del menú de carga (manual, pendientes, ingreso)', () => {
    assert.equal(callbackPermitidoChofer('cg:factura_manual'), false)
    assert.equal(callbackPermitidoChofer('cg:pendientes'), false)
    assert.equal(callbackPermitidoChofer('cg:ingreso_ia'), false)
    assert.equal(callbackPermitidoChofer('cg:nota_ingreso_manual'), false)
  })

  it('deja pasar los pasos de la carga que el chofer abrió (selectores, fotos)', () => {
    assert.equal(callbackPermitidoChofer('fd:12345'), true)
  })
})
