import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buscarEnCatalogoBase,
  categoriasDeCatalogo,
  itemsDeCategoria,
  type ItemCatalogoBase,
} from './catalogoBase'
import { cantidadPedibleAlAlmacen } from './procuraDepartamentoTelegram'

/** Lee los ítems de la migración 361 (la misma lista que se carga en la base). */
function itemsDeLaMigracion(): ItemCatalogoBase[] {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/361_catalogo_base_obra_civil.sql'), 'utf8')
  const re = /\('([A-Z]{3}-\d{3})', '((?:[^']|'')*)', (\d+), '((?:[^']|'')*)', '((?:[^']|'')*)', '([A-Z0-9]+)', '((?:[^']|'')*)', (\d+)\)/g
  const items: ItemCatalogoBase[] = []
  for (const m of sql.matchAll(re)) {
    const u = (s: string) => s.replace(/''/g, "'")
    items.push({
      id: m[1],
      codigo: m[1],
      categoria: u(m[2]),
      categoria_orden: Number(m[3]),
      grupo: u(m[4]),
      nombre: u(m[5]),
      unidad: m[6],
      palabras_clave: u(m[7]),
      orden: Number(m[8]),
    })
  }
  return items
}

describe('catálogo base de obra civil', () => {
  const items = itemsDeLaMigracion()

  it('la migración trae el catálogo completo, sin códigos ni nombres repetidos', () => {
    assert.ok(items.length >= 290, `ítems: ${items.length}`)
    assert.equal(new Set(items.map((i) => i.codigo)).size, items.length)
    assert.equal(new Set(items.map((i) => `${i.categoria}|${i.nombre}`)).size, items.length)
  })

  it('cubre las categorías pedidas', () => {
    const cats = categoriasDeCatalogo(items).map((c) => c.nombre.toLowerCase()).join(' | ')
    for (const k of ['cabillas', 'piedra', 'bloques', 'tuberías', 'clavos', 'sanitarios', 'ventanas', 'techos', 'herramientas', 'servicios']) {
      assert.ok(cats.includes(k), `falta categoría con «${k}»: ${cats}`)
    }
  })

  it('no trae precios ni proveedores (el repositorio es público)', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/361_catalogo_base_obra_civil.sql'), 'utf8')
    const columnas = sql.match(/insert into public\.ci_catalogo_base \(([^)]+)\)/)?.[1] ?? ''
    assert.equal(columnas, 'codigo, categoria, categoria_orden, grupo, nombre, unidad, palabras_clave, orden')
    const tabla = sql.match(/create table if not exists public\.ci_catalogo_base \(([\s\S]*?)\n\);/)?.[1] ?? ''
    assert.doesNotMatch(tabla, /precio|price|cost|proveedor|supplier/i)
  })

  it('categorías en orden y con sus ítems', () => {
    const cats = categoriasDeCatalogo(items)
    assert.deepEqual(cats.map((c) => c.orden), [...cats.map((c) => c.orden)].sort((a, b) => a - b))
    const acero = itemsDeCategoria(items, cats[0].orden)
    assert.ok(acero.length > 5)
    assert.ok(acero.every((i) => i.categoria === cats[0].nombre))
  })

  it('busca sin acentos, en cualquier orden y por palabras clave', () => {
    assert.match(buscarEnCatalogoBase(items, 'cabilla 1/2')[0]?.nombre ?? '', /Cabilla 1\/2/)
    assert.match(buscarEnCatalogoBase(items, 'POCETA')[0]?.nombre ?? '', /Poceta/)
    assert.ok(buscarEnCatalogoBase(items, 'tuberia cloaca 4').some((i) => /aguas negras 4/.test(i.nombre)))
    assert.ok(buscarEnCatalogoBase(items, 'truckson').some((i) => /Malla/.test(i.nombre)))
    assert.match(buscarEnCatalogoBase(items, 'cabilla 3/8')[0]?.nombre ?? '', /3\/8/)
    assert.ok(!buscarEnCatalogoBase(items, 'cabilla 1/2').some((i) => /1\/4/.test(i.nombre)))
    assert.match(buscarEnCatalogoBase(items, 'bloque 15')[0]?.nombre ?? '', /15/)
    assert.ok(buscarEnCatalogoBase(items, 'clav').length >= 5, 'prefijo')
    assert.deepEqual(buscarEnCatalogoBase(items, 'x'), [])
  })
})

describe('almacén primero', () => {
  const base = {
    hayStock: true,
    ubicacionId: 'ub',
    materialId: 'm',
    stock: 10,
    unidadStock: 'SAC',
    cantidad: 4,
    unidad: 'SAC',
  }

  it('alcanza: se pide todo al almacén', () => {
    assert.equal(cantidadPedibleAlAlmacen(base), 4)
  })

  it('no alcanza: se pide lo que hay', () => {
    assert.equal(cantidadPedibleAlAlmacen({ ...base, cantidad: 25 }), 10)
  })

  it('unidades distintas o sin material/almacén: no se ofrece', () => {
    assert.equal(cantidadPedibleAlAlmacen({ ...base, unidad: 'KG' }), 0)
    assert.equal(cantidadPedibleAlAlmacen({ ...base, materialId: null }), 0)
    assert.equal(cantidadPedibleAlAlmacen({ ...base, ubicacionId: null }), 0)
    assert.equal(cantidadPedibleAlAlmacen({ ...base, hayStock: false }), 0)
  })

  it('normaliza la unidad (sacos = SAC)', () => {
    assert.equal(cantidadPedibleAlAlmacen({ ...base, unidad: 'sacos' }), 4)
  })
})
