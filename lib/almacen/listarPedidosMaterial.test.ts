import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import { listarPedidosMaterial } from './listarPedidosMaterial'

const filas = [
  {
    id: 'p1',
    codigo: 'RQ-0001',
    estado: 'despachado',
    tipo: 'traspaso',
    material_nombre: 'Cemento gris',
    cantidad: 6,
    unidad: 'SACO',
    motivo: 'Losa nivel 2',
    origen_ubicacion_id: 'ub-almacen',
    destino_ubicacion_id: 'ub-otra',
    solicitante_nombre: 'Ing. Ana',
    despachador_nombre: 'Pedro Depósito',
    transferencia_id: 't1',
    created_at: '2026-10-10T10:00:00Z',
    despachado_at: '2026-10-10T11:00:00Z',
    fotos: [{ storage_path: 'telegram-movimientos/obra/requerimientos/p1-1.jpg', url: 'x' }],
    ci_proyectos: { nombre: 'Obra Norte' },
  },
  {
    id: 'p2',
    codigo: 'RQ-0002',
    estado: 'solicitado',
    tipo: 'uso',
    material_nombre: 'Cabilla',
    cantidad: 3,
    unidad: 'UND',
    origen_ubicacion_id: 'ub-almacen',
    destino_ubicacion_id: null,
    created_at: '2026-10-11T10:00:00Z',
    fotos: [],
  },
  {
    id: 'p3',
    codigo: 'RQ-0003',
    estado: 'rechazado',
    tipo: 'tipo-desconocido',
    material_nombre: 'Arena',
    cantidad: '2.5',
    unidad: 'M3',
    origen_ubicacion_id: 'ub-almacen',
    motivo_rechazo: 'No hay esa cantidad',
    created_at: '2026-10-09T10:00:00Z',
    fotos: null,
  },
]

function db() {
  return crearFakeSupabase({
    inv_requerimientos_salida: filas.map((f) => ({ ...f })),
    inv_ubicaciones: [
      { id: 'ub-almacen', nombre: 'Almacén Obra Norte' },
      { id: 'ub-otra', nombre: 'Obra Sur' },
    ],
    transferencias_inventario: [{ id: 't1', codigo: 'TRF-77' }],
  })
}

describe('cuadro de pedidos de material', () => {
  it('lista los más recientes primero, con obra, origen, destino, movimiento y enlace a la foto', async () => {
    const { pedidos, sinMigracion } = await listarPedidosMaterial(db() as unknown as SupabaseClient)

    assert.equal(sinMigracion, false)
    assert.deepEqual(pedidos.map((p) => p.id), ['p2', 'p1', 'p3'])
    const p1 = pedidos[1]
    assert.equal(p1.obra, 'Obra Norte')
    assert.equal(p1.origen, 'Almacén Obra Norte')
    assert.equal(p1.destino, 'Obra Sur')
    assert.equal(p1.movimiento_codigo, 'TRF-77')
    assert.equal(p1.solicitante_nombre, 'Ing. Ana')
    assert.equal(p1.despachador_nombre, 'Pedro Depósito')
    assert.deepEqual(p1.fotos, [
      'https://storage.test/firmado/ci-proyectos-media/telegram-movimientos/obra/requerimientos/p1-1.jpg',
    ])
    assert.equal(pedidos[0].destino, null)
    assert.deepEqual(pedidos[0].fotos, [])
  })

  it('tolera datos incompletos: cantidad como texto y tipo desconocido', async () => {
    const { pedidos } = await listarPedidosMaterial(db() as unknown as SupabaseClient)
    const p3 = pedidos[2]
    assert.equal(p3.cantidad, 2.5)
    assert.equal(p3.tipo, 'uso')
    assert.equal(p3.motivo_rechazo, 'No hay esa cantidad')
    assert.equal(p3.obra, null)
  })

  it('«por despachar» deja fuera lo despachado y lo rechazado', async () => {
    const { pedidos } = await listarPedidosMaterial(db() as unknown as SupabaseClient, { soloActivos: true })
    assert.deepEqual(pedidos.map((p) => p.id), ['p2'])
  })

  it('sin la migración 343 lo dice en vez de fallar', async () => {
    const vacia = crearFakeSupabase({}, { tablasAusentes: ['inv_requerimientos_salida'] })
    const lista = await listarPedidosMaterial(vacia as unknown as SupabaseClient)
    assert.deepEqual(lista, { pedidos: [], sinMigracion: true })
  })
})
