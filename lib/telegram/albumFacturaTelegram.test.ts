import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { esperarYReclamarAlbumFactura } from './albumFacturaTelegram'

describe('esperarYReclamarAlbumFactura', () => {
  it('no reclama si llegó otra foto durante el debounce', async () => {
    const t0 = Date.parse('2026-01-01T00:00:05.000Z')
    const fake = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'p1',
                      estado: 'recibido',
                      album_last_part_at: '2026-01-01T00:00:04.500Z',
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      },
    } as unknown as SupabaseClient

    const r = await esperarYReclamarAlbumFactura({
      supabase: fake,
      pendingId: 'p1',
      debounceMs: 1000,
      dormir: async () => {},
      ahora: () => t0,
    })
    assert.equal(r, 'too_soon')
  })

  it('reclama una sola vez cuando el álbum ya no recibe fotos', async () => {
    const updates: Array<{ estado?: string }> = []
    const fake = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'p1',
                      estado: 'recibido',
                      album_last_part_at: '2026-01-01T00:00:00.000Z',
                    },
                    error: null,
                  }),
                }
              },
            }
          },
          update(payload: { estado?: string }) {
            updates.push(payload)
            return {
              eq() {
                return {
                  in() {
                    return {
                      select() {
                        return {
                          maybeSingle: async () => ({ data: { id: 'p1' }, error: null }),
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

    const r = await esperarYReclamarAlbumFactura({
      supabase: fake,
      pendingId: 'p1',
      debounceMs: 10,
      dormir: async () => {},
      ahora: () => Date.parse('2026-01-01T00:00:05.000Z'),
    })
    assert.equal(r, 'claimed')
    assert.equal(updates[0]?.estado, 'procesando')
  })
})
