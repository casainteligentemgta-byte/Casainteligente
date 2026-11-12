import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reintentarOcrPendientesCanal } from './reintentarOcrPendientes'

function fakeSupabase(rows: Array<Record<string, unknown>>, claimedIds: string[]) {
  return {
    from() {
      return {
        select() {
          return {
            in() {
              return {
                order() {
                  return {
                    limit: async () => ({ data: rows, error: null }),
                  }
                },
              }
            },
          }
        },
        update() {
          return {
            eq() {
              return {
                in() {
                  return {
                    select() {
                      return {
                        maybeSingle: async () => {
                          const id = claimedIds[claimedIds.length] ? null : rows[0]?.id
                          claimedIds.push(String(id ?? rows[0]?.id ?? ''))
                          return { data: { id: rows[0]?.id }, error: null }
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  } as unknown as SupabaseClient
}

describe('reintentarOcrPendientesCanal', () => {
  it('reclama y reprocesa con la fila ya guardada (álbum incluido)', async () => {
    const procesadas: string[] = []
    const claimed: string[] = []
    const rows = [
      {
        id: 'album-1',
        estado: 'error_ocr',
        ocr_intentos: 2,
        ocr_proximo_reintento_at: '2026-11-11T11:00:00.000Z',
        document_parts: [
          { orden: 0, storage_path: 'a.jpg' },
          { orden: 1, storage_path: 'b.jpg' },
        ],
        updated_at: '2026-11-11T11:00:00.000Z',
      },
    ]
    const result = await reintentarOcrPendientesCanal(fakeSupabase(rows, claimed), {
      ahora: new Date('2026-11-11T12:00:00.000Z'),
      procesar: async (row) => {
        procesadas.push(row.id)
        assert.ok(Array.isArray(row.document_parts))
        assert.equal(row.document_parts?.length, 2)
      },
    })
    assert.equal(result.revisadas, 1)
    assert.equal(result.reclamadas, 1)
    assert.equal(result.ok, 1)
    assert.equal(result.errores, 0)
    assert.deepEqual(procesadas, ['album-1'])
  })

  it('cuenta error si el reproceso lanza, sin tumbar el lote', async () => {
    const claimed: string[] = []
    const rows = [
      {
        id: 'p-err',
        estado: 'error_ocr',
        ocr_intentos: 1,
        ocr_proximo_reintento_at: '2026-11-11T11:00:00.000Z',
        document_storage_path: 'x.jpg',
        updated_at: '2026-11-11T11:00:00.000Z',
      },
    ]
    const result = await reintentarOcrPendientesCanal(fakeSupabase(rows, claimed), {
      ahora: new Date('2026-11-11T12:00:00.000Z'),
      procesar: async () => {
        throw new Error('fetch failed')
      },
    })
    assert.equal(result.reclamadas, 1)
    assert.equal(result.ok, 0)
    assert.equal(result.errores, 1)
  })
})
