import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import { listarRetirosCompra } from './listarRetirosCompra'

const filas = [
  {
    id: 'r1',
    estado: 'en_camino',
    numero_factura: 'A-1',
    proveedor_nombre: 'Ferretería',
    transportista_nombre: 'Luis Chofer',
    created_at: '2026-10-10T10:00:00Z',
    retirado_at: '2026-10-10T11:00:00Z',
    fotos: [{ storage_path: 'retiros-compra/r1/1.jpg' }],
    ci_proyectos: { nombre: 'Obra Norte' },
    inv_ubicaciones: [{ nombre: 'Almacén Obra Norte' }],
    ci_procuras: { ticket: 'PR-2026-00099' },
  },
  { id: 'r2', estado: 'entregado', numero_factura: 'A-2', created_at: '2026-10-09T10:00:00Z', fotos: [] },
  { id: 'r3', estado: 'pendiente', numero_factura: 'A-3', created_at: '2026-10-11T10:00:00Z', fotos: null },
]

describe('cuadro de retiros', () => {
  it('lista los más recientes primero, con obra, almacén, ticket y enlace a la foto', async () => {
    const db = crearFakeSupabase({ ci_compras_retiros: filas.map((f) => ({ ...f })) })
    const { retiros, sinMigracion } = await listarRetirosCompra(db as unknown as SupabaseClient)

    assert.equal(sinMigracion, false)
    assert.deepEqual(retiros.map((r) => r.id), ['r3', 'r1', 'r2'])
    const r1 = retiros[1]
    assert.equal(r1.obra, 'Obra Norte')
    assert.equal(r1.almacen, 'Almacén Obra Norte')
    assert.equal(r1.ticket_procura, 'PR-2026-00099')
    assert.equal(r1.transportista_nombre, 'Luis Chofer')
    assert.deepEqual(r1.fotos, ['https://storage.test/firmado/procurement-documents/retiros-compra/r1/1.jpg'])
    assert.deepEqual(retiros[0].fotos, [])
  })

  it('«en curso» deja fuera lo entregado', async () => {
    const db = crearFakeSupabase({ ci_compras_retiros: filas.map((f) => ({ ...f })) })
    const { retiros } = await listarRetirosCompra(db as unknown as SupabaseClient, { soloActivos: true })
    assert.deepEqual(retiros.map((r) => r.id), ['r3', 'r1'])
  })

  it('sin la migración 341 lo dice en vez de fallar', async () => {
    const db = crearFakeSupabase({}, { tablasAusentes: ['ci_compras_retiros'] })
    const lista = await listarRetirosCompra(db as unknown as SupabaseClient)
    assert.deepEqual(lista, { retiros: [], sinMigracion: true })
  })
})
