import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ConflictoEdicionError,
  MENSAJE_CONFLICTO_EDICION,
  reclamarVersionPendiente,
} from './edicionConcurrente'

/** Fake de update().eq().eq().select(): devuelve `filas` como resultado. */
function supabaseConFilas(filas: Array<{ id: string }>, fallo?: { message: string }) {
  const llamadas: Array<[string, unknown]> = []
  const db = {
    from() {
      const b = {
        update(payload: Record<string, unknown>) {
          llamadas.push(['update', payload])
          return b
        },
        eq(columna: string, valor: unknown) {
          llamadas.push(['eq', [columna, valor]])
          return b
        },
        select() {
          return Promise.resolve({ data: fallo ? null : filas, error: fallo ?? null })
        },
      }
      return b
    },
  } as unknown as SupabaseClient
  return { db, llamadas }
}

describe('reclamarVersionPendiente', () => {
  it('no lanza cuando la versión coincide', async () => {
    const { db, llamadas } = supabaseConFilas([{ id: 'p1' }])
    await reclamarVersionPendiente(db, 'p1', '2026-10-26T12:00:00.000000+00:00')
    assert.deepEqual(llamadas[1], ['eq', ['id', 'p1']])
    assert.deepEqual(llamadas[2], ['eq', ['updated_at', '2026-10-26T12:00:00.000000+00:00']])
  })

  it('lanza conflicto cuando nadie coincide (otra edición ya cambió la versión)', async () => {
    const { db } = supabaseConFilas([])
    await assert.rejects(
      () => reclamarVersionPendiente(db, 'p1', 'vieja'),
      (err: unknown) => err instanceof ConflictoEdicionError && err.message === MENSAJE_CONFLICTO_EDICION,
    )
  })

  it('propaga errores de base de datos', async () => {
    const { db } = supabaseConFilas([], { message: 'boom' })
    await assert.rejects(
      () => reclamarVersionPendiente(db, 'p1', 'x'),
      (err: unknown) => (err as { message?: string }).message === 'boom',
    )
  })
})
