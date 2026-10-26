import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MENSAJE_FACTURA_DUPLICADA,
  esErrorFacturaDuplicada,
  marcarPendienteDuplicado,
} from './facturaDuplicada'

describe('esErrorFacturaDuplicada', () => {
  it('reconoce la violación de índice único (23505)', () => {
    assert.equal(esErrorFacturaDuplicada({ code: '23505' }), true)
  })

  it('ignora otros errores y la ausencia de error', () => {
    assert.equal(esErrorFacturaDuplicada({ code: '23503' }), false)
    assert.equal(esErrorFacturaDuplicada({}), false)
    assert.equal(esErrorFacturaDuplicada(null), false)
    assert.equal(esErrorFacturaDuplicada(undefined), false)
  })
})

describe('marcarPendienteDuplicado', () => {
  it('pasa la carga a error con el motivo y solo toca esa fila', async () => {
    const llamadas: { tabla?: string; payload?: Record<string, unknown>; eq?: [string, unknown] } = {}
    const fake = {
      from(tabla: string) {
        llamadas.tabla = tabla
        return {
          update(payload: Record<string, unknown>) {
            llamadas.payload = payload
            return {
              eq(columna: string, valor: unknown) {
                llamadas.eq = [columna, valor]
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      },
    } as unknown as SupabaseClient

    await marcarPendienteDuplicado(fake, 'pend-1')

    assert.equal(llamadas.tabla, 'ci_facturas_canal_pendientes')
    assert.equal(llamadas.payload?.estado, 'error')
    assert.equal(llamadas.payload?.mensaje_error, MENSAJE_FACTURA_DUPLICADA)
    assert.equal(llamadas.payload && 'extracted' in llamadas.payload, false)
    assert.deepEqual(llamadas.eq, ['id', 'pend-1'])
  })
})
