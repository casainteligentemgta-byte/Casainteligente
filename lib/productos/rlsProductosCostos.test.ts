import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { esErrorVistaProductos } from './tablaProductos'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/398_productos_margen_foto_rls_costos.sql'),
  'utf8',
)

describe('migración 398: margen, foto y RLS de costos', () => {
  it('agrega margen_pct al producto y margen por defecto a la categoría', () => {
    assert.match(sql, /add column if not exists margen_pct numeric\(7, 2\)/)
    assert.match(sql, /product_categories[\s\S]*margen_pct_defecto/)
    assert.doesNotMatch(sql, /update public\.products\s+set precio/i)
  })

  it('unifica foto en imagen y no inventa URLs', () => {
    assert.match(sql, /set imagen = image_url/)
    assert.match(sql, /products_sync_foto/)
    assert.doesNotMatch(sql, /unsplash|placeholder\.com|picsum/i)
  })

  it('revoca anon y esconde costo sin permiso productos.costos', () => {
    assert.match(sql, /revoke all on table public\.products from anon/i)
    assert.match(sql, /revoke select \(costo, utilidad, margen_pct\)/)
    assert.match(sql, /products_lectura/)
    assert.match(sql, /security_invoker = false/)
    assert.match(sql, /ci_tiene_permiso\('productos\.costos'\)/)
    assert.match(sql, /'productos\.ver'/)
  })
})

describe('fallback si la vista aún no existe', () => {
  it('reconoce el error de PostgREST / Postgres', () => {
    assert.equal(esErrorVistaProductos({ code: 'PGRST205', message: 'Could not find the table' }), true)
    assert.equal(esErrorVistaProductos({ code: '42P01', message: 'relation "products_lectura" does not exist' }), true)
    assert.equal(esErrorVistaProductos({ code: '42501', message: 'permission denied for table products' }), false)
    assert.equal(esErrorVistaProductos(null), false)
  })
})
