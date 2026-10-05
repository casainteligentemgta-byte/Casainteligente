import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { BomLine } from '@/lib/netvision/types'
import { buildBom } from '@/lib/netvision/services/bandwidthCalculator'
import type { UndergroundPlan } from '@/lib/netvision/services/canalizationCalculator'
import {
  MARGEN_VENTAS_DEFECTO,
  buscarProductos,
  claveEnlace,
  construirPresupuesto,
  enlacesParaGuardar,
  notasPresupuesto,
  precioVentaProducto,
  renglonesDesdeBom,
  sugerirProductos,
  type ProductoVenta,
} from './presupuesto'

const linea = (sku: string, description: string, qty: number, unitUsd: number, extra: Partial<BomLine> = {}): BomLine => ({
  sku,
  category: 'camera',
  description,
  qty,
  unitUsd,
  totalUsd: Math.round(qty * unitUsd * 100) / 100,
  ...extra,
})

const productos: ProductoVenta[] = [
  { id: 10, nombre: 'Cámara EZVIZ H9c Dual 2K', marca: 'EZVIZ', modelo: 'H9c', categoria: 'CCTV', costo: 80, precio: 100, imagen: 'data:image/png;base64,AAAA' },
  { id: 11, nombre: 'Cámara EZVIZ H3 3K', marca: 'EZVIZ', modelo: 'H3', categoria: 'CCTV', costo: 50, precio: 60 },
  { id: 12, nombre: 'Cable UTP Cat 6 exterior (metro)', marca: 'Wireplus', modelo: 'CAT6', categoria: 'Cable', costo: 0.3, precio: 0.5 },
  { id: 13, nombre: 'Switch UniFi Lite 8 PoE', marca: 'Ubiquiti', modelo: 'USW-Lite-8-PoE', categoria: 'Redes', costo: 100, precio: 120 },
]

describe('presupuesto desde NetVision', () => {
  const bom = {
    lines: [
      linea('ezviz-h9c', 'Ezviz H9c Dual 2K', 2, 95),
      linea('ezviz-h3', 'Ezviz H3 3K Bullet', 6, 55),
      linea('CABLE-CAT6', 'Cable Cat 6', 138.2, 0.12, { category: 'cable' }),
      linea('POE-SPLITTER-12V', 'Adaptador PoE (splitter) de 12 V', 8, 6, { category: 'poe' }),
      linea('mon-24-ab12', 'Hikvision Monitor 24"', 1, 190, { category: 'monitor', linkKey: 'mon-24' }),
      linea('mon-24-cd34', 'Hikvision Monitor 24"', 1, 190, { category: 'monitor', linkKey: 'mon-24' }),
      linea('ZANJA-TERCERO', 'Canalización subterránea (24 m): a cargo de otro contratista', 1, 0, { category: 'conduit' }),
    ],
  }

  it('usa el margen por defecto de Ventas', () => {
    assert.equal(MARGEN_VENTAS_DEFECTO, 20)
    assert.equal(precioVentaProducto({ precio: 100 }), 120)
    assert.equal(precioVentaProducto({ precio: 0.5 }), 0.6)
    assert.equal(precioVentaProducto({ precio: null }), 0)
    assert.equal(precioVentaProducto({ precio: 100 }, 35), 135)
  })

  it('sin enlaces: todo sale como renglón libre con el precio de referencia', () => {
    const { renglones, notas } = renglonesDesdeBom(bom)
    assert.deepEqual(notas, ['Canalización subterránea (24 m): a cargo de otro contratista'])
    assert.equal(renglones.length, 5)
    assert.ok(renglones.every((r) => r.productId === null && r.incluir))
    const splitter = renglones.find((r) => r.clave === 'poe-splitter-12v')!
    assert.equal(splitter.qty, 8)
    assert.equal(splitter.precioUnit, 6)
    // Los dos monitores iguales se juntan en un renglón.
    const monitor = renglones.find((r) => r.clave === 'mon-24')!
    assert.equal(monitor.qty, 2)
  })

  it('con enlaces recordados: sale el producto y su precio de venta', () => {
    const { renglones } = renglonesDesdeBom(bom, { 'ezviz-h9c': 10, 'cable-cat6': 12, 'ezviz-h3': 999 }, productos)
    const h9c = renglones.find((r) => r.clave === 'ezviz-h9c')!
    assert.equal(h9c.productId, 10)
    assert.equal(h9c.precioUnit, 120)
    const cable = renglones.find((r) => r.clave === 'cable-cat6')!
    assert.equal(cable.productId, 12)
    assert.equal(cable.precioUnit, 0.6)
    // Enlace a un producto que ya no existe: vuelve a renglón libre.
    const h3 = renglones.find((r) => r.clave === 'ezviz-h3')!
    assert.equal(h3.productId, null)
    assert.equal(h3.precioUnit, 55)
  })

  it('arma los ítems con la forma de /ventas y calcula totales', () => {
    const { renglones } = renglonesDesdeBom(bom, { 'ezviz-h9c': 10, 'ezviz-h3': 11 }, productos)
    const p = construirPresupuesto(renglones, productos)
    assert.equal(p.items.length, 5)
    const [h9c, h3, cable] = p.items as [typeof p.items[number], typeof p.items[number], typeof p.items[number]]
    assert.equal(h9c.product_id, 10)
    assert.equal(h9c.qty, 2)
    assert.equal(h9c.unit_price, 120)
    assert.equal(h9c.product_data.nombre, 'Cámara EZVIZ H9c Dual 2K')
    assert.ok(!('imagen' in h9c.product_data), 'no guarda la imagen del producto')
    assert.equal(h3.product_id, 11)
    assert.equal(h3.unit_price, 72)
    // Renglón libre: id negativo y datos mínimos para que /ventas lo muestre.
    assert.ok(cable.product_id < 0)
    assert.equal(cable.product_data.id, cable.product_id)
    assert.equal(cable.product_data.nombre, 'Cable Cat 6')
    assert.equal(cable.unit_price, 0.12)
    assert.deepEqual(cable.inventory_item_ids, [])
    const idsLibres = p.items.filter((i) => i.product_id < 0).map((i) => i.product_id)
    assert.equal(new Set(idsLibres).size, idsLibres.length, 'ids libres únicos')

    const subtotal = 2 * 120 + 6 * 72 + 138.2 * 0.12 + 8 * 6 + 2 * 190
    const costo = 2 * 80 + 6 * 50 + 138.2 * 0.12 + 8 * 6 + 2 * 190
    assert.equal(p.subtotal, Math.round(subtotal * 100) / 100)
    assert.equal(p.total_cost, Math.round(costo * 100) / 100)
    assert.equal(p.total_profit, Math.round((p.subtotal - p.total_cost) * 100) / 100)
    assert.equal(p.margin_pct, Math.round((p.total_profit / p.subtotal) * 10000) / 100)
  })

  it('respeta lo que el usuario quita o cambia', () => {
    const { renglones } = renglonesDesdeBom(bom)
    const editados = renglones.map((r) =>
      r.clave === 'cable-cat6'
        ? { ...r, incluir: false }
        : r.clave === 'ezviz-h9c'
          ? { ...r, qty: 3, precioUnit: 150 }
          : r,
    )
    const p = construirPresupuesto(editados, productos)
    assert.equal(p.items.length, 4)
    assert.equal(p.items[0]!.qty, 3)
    assert.equal(p.items[0]!.unit_price, 150)
    assert.equal(construirPresupuesto([], productos).subtotal, 0)
    assert.equal(construirPresupuesto([], productos).margin_pct, 0)
  })

  it('recuerda solo los renglones enlazados', () => {
    const { renglones } = renglonesDesdeBom(bom, { 'mon-24': 13 }, productos)
    assert.deepEqual(enlacesParaGuardar(renglones), [{ sku: 'mon-24', product_id: 13 }])
    assert.equal(claveEnlace({ sku: 'mon-24-ab12', linkKey: 'mon-24' }), 'mon-24')
    assert.equal(claveEnlace({ sku: 'CABLE-CAT6' }), 'cable-cat6')
  })

  it('propone productos parecidos y busca por texto', () => {
    assert.equal(sugerirProductos('Ezviz H9c Dual 2K', productos)[0]?.id, 10)
    assert.equal(sugerirProductos('Ezviz H3 3K Bullet', productos)[0]?.id, 11)
    assert.deepEqual(sugerirProductos('Excavación medio (3 m³)', productos), [])
    assert.deepEqual(buscarProductos('cat 6', productos).map((p) => p.id), [12])
    assert.deepEqual(buscarProductos('ezviz', productos).map((p) => p.id), [10, 11])
    assert.deepEqual(buscarProductos('  ', productos), [])
    assert.deepEqual(buscarProductos('camara h9c', productos).map((p) => p.id), [10])
  })

  it('las notas dicen de dónde salió y lo que hace otro contratista', () => {
    assert.equal(
      notasPresupuesto('Casa Pérez', ['Canalización subterránea (24 m): a cargo de otro contratista']),
      'Generado desde NetVision: Casa Pérez.\nCanalización subterránea (24 m): a cargo de otro contratista.',
    )
    assert.equal(notasPresupuesto('  ', []), 'Generado desde NetVision: proyecto sin nombre.')
  })
})

describe('zanja: solo se cobra si se elige «Cobrar»', () => {
  const cam = (i: number) => ({ id: `c${i}`, label: `CAM-0${i}`, x: 0.5, y: 0.5, modelId: 'ezviz-h3', yawDeg: 0, mountHeightM: 3 })
  const plan = {
    zone: 'pedestrian',
    terrain: 'medium',
    chamberMaterial: 'polietileno',
    runs: [{ id: 'r1', lengthM: 24, pipe: { id: 'pvc-50', label: 'PVC 50 mm', usdPerM: 3, innerMm: 50 }, chambers: [], depthCm: 60 }],
    excavation: { volumeM3: 4, costUsd: 120, terrain: 'medio', needsShoring: false },
    totalPipeM: 24,
    totalChambers: 2,
  } as unknown as UndergroundPlan
  const esZanja = (l: BomLine) => /subterr|Excavaci|EXCAV|PVC|ZANJA/i.test(`${l.sku} ${l.description}`)
  const bomCon = (zanjaModo?: 'cobrar' | 'no_cobrar' | 'otro_contratista') =>
    buildBom([cam(1), cam(2)], 30, [], [], [], plan, [], zanjaModo ? { zanjaModo } : {})

  it('por defecto (o «no cobrar») no aparece ni suma', () => {
    const sin = bomCon()
    const no = bomCon('no_cobrar')
    assert.deepEqual(sin.lines.filter(esZanja), [])
    assert.deepEqual(no.lines.filter(esZanja), [])
    assert.equal(sin.totalUsd, no.totalUsd)
  })

  it('«cobrar» suma tubería, tanquillas y excavación', () => {
    const cobrar = bomCon('cobrar')
    const base = new Set(bomCon('no_cobrar').lines.map((l) => l.sku))
    const zanja = cobrar.lines.filter((l) => !base.has(l.sku))
    assert.ok(zanja.length >= 3, JSON.stringify(zanja.map((l) => l.sku)))
    assert.ok(zanja.some((l) => l.sku === 'EXCAV-M3'))
    const monto = zanja.reduce((s, l) => s + l.totalUsd, 0)
    assert.ok(monto > 0)
    assert.ok(Math.abs(cobrar.totalUsd - (bomCon('no_cobrar').totalUsd + monto)) < 0.01)
  })

  it('«otro contratista» deja una nota sin monto', () => {
    const otro = bomCon('otro_contratista')
    const zanja = otro.lines.filter(esZanja)
    assert.equal(zanja.length, 1)
    assert.equal(zanja[0]!.sku, 'ZANJA-TERCERO')
    assert.equal(zanja[0]!.totalUsd, 0)
    assert.match(zanja[0]!.description, /Canalización subterránea \(24 m\): a cargo de otro contratista/)
    assert.equal(otro.totalUsd, bomCon('no_cobrar').totalUsd)
    // En el presupuesto va como nota, no como producto.
    const { renglones, notas } = renglonesDesdeBom(otro)
    assert.equal(notas.length, 1)
    assert.ok(!renglones.some((r) => /subterr/i.test(r.descripcion)))
  })

  it('los adaptadores PoE (splitter) entran a la lista', () => {
    const bom = bomCon()
    const sp = bom.lines.find((l) => l.sku === 'POE-SPLITTER-12V')!
    assert.equal(sp.qty, 2)
    assert.equal(sp.category, 'poe')
    assert.ok(sp.totalUsd > 0)
    const sinSplitter = buildBom([{ ...cam(1), modelId: 'ezviz-h4-poe' }], 30)
    assert.ok(!sinSplitter.lines.some((l) => l.sku.startsWith('POE-SPLITTER')))
  })
})
