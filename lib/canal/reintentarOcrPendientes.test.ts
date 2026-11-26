import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  reintentarOcrPendientePorId,
  reintentarOcrPendientesCanal,
  rescatarLecturasAtascadas,
} from './reintentarOcrPendientes'

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

  it('por id fuerza el reintento aunque el backoff aún no venza (encadenado, no cron diario)', async () => {
    const procesadas: string[] = []
    const row = {
      id: 'encadenada',
      estado: 'error_ocr',
      ocr_intentos: 1,
      ocr_proximo_reintento_at: '2026-11-11T12:10:00.000Z',
      document_storage_path: 'neo.jpg',
      updated_at: '2026-11-11T12:00:00.000Z',
    }
    const fake = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: row, error: null }),
                }
              },
              in() {
                return {
                  order() {
                    return {
                      limit: async () => ({ data: [row], error: null }),
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
                          maybeSingle: async () => ({ data: { id: row.id }, error: null }),
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

    const result = await reintentarOcrPendientePorId(fake, 'encadenada', {
      forzar: true,
      ahora: new Date('2026-11-11T12:00:01.000Z'),
      procesar: async (r) => {
        procesadas.push(r.id)
      },
    })
    assert.equal(result.revisadas, 1)
    assert.equal(result.reclamadas, 1)
    assert.equal(result.ok, 1)
    assert.deepEqual(procesadas, ['encadenada'])
  })
})

function fakeRescate(rows: Array<Record<string, unknown>>, reclamoOk = true) {
  const updates: Array<Record<string, unknown>> = []
  const client = {
    from() {
      let modoUpdate = false
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is', 'lte', 'gte', 'order']) {
        b[m] = () => b
      }
      b.update = (payload: Record<string, unknown>) => {
        modoUpdate = true
        updates.push(payload)
        return b
      }
      b.limit = async () => ({ data: rows, error: null })
      b.maybeSingle = async () => ({ data: reclamoOk && modoUpdate ? { id: 'x' } : null, error: null })
      b.then = (res: (v: unknown) => unknown) => res({ error: null })
      return b
    },
  } as unknown as SupabaseClient
  return { client, updates }
}

describe('rescatarLecturasAtascadas', () => {
  const ahora = new Date('2026-11-26T20:00:00.000Z')
  const colgada = {
    id: '39d13d33',
    estado: 'procesando',
    canal: 'telegram',
    chat_id: '111',
    ocr_intentos: 0,
    document_storage_path: 'telegram-pending/a.jpg',
    updated_at: '2026-11-26T15:01:00.000Z',
  }

  it('reintenta la foto colgada sin intentos y la cuenta como primer intento', async () => {
    const { client, updates } = fakeRescate([colgada])
    const procesadas: Array<[string, number | null | undefined]> = []
    const out = await rescatarLecturasAtascadas(client, {
      ahora,
      procesar: async (row) => {
        procesadas.push([row.id, row.ocr_intentos])
      },
    })
    assert.equal(out.reintentadas, 1)
    assert.equal(out.ok, 1)
    assert.deepEqual(procesadas, [['39d13d33', 1]])
    assert.equal(updates[0].ocr_intentos, 1)
  })

  it('si otro barrido ya la reclamó no la procesa dos veces', async () => {
    const { client } = fakeRescate([colgada], false)
    let llamadas = 0
    const out = await rescatarLecturasAtascadas(client, {
      ahora,
      procesar: async () => {
        llamadas += 1
      },
    })
    assert.equal(llamadas, 0)
    assert.equal(out.reintentadas, 0)
  })

  it('cuenta el error si el reintento falla (el cierre con ❌ lo hace el procesar real)', async () => {
    const { client } = fakeRescate([colgada])
    const out = await rescatarLecturasAtascadas(client, {
      ahora,
      procesar: async () => {
        throw new Error('fetch failed')
      },
    })
    assert.equal(out.reintentadas, 1)
    assert.equal(out.errores, 1)
    assert.equal(out.ok, 0)
  })

  it('ignora lo que decide el reintento normal (1–2 intentos)', async () => {
    const { client } = fakeRescate([{ ...colgada, ocr_intentos: 1 }])
    const out = await rescatarLecturasAtascadas(client, {
      ahora,
      procesar: async () => {
        throw new Error('no debía llamarse')
      },
    })
    assert.equal(out.revisadas, 0)
    assert.equal(out.errores, 0)
  })
})
