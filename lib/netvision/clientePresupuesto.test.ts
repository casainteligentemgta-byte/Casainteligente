import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProject, projectFromPartial } from '@/lib/netvision/storage'
import { proyectoParaCliente } from '@/lib/netvision/compartir'
import {
  hayOfertaCliente,
  notaParaCliente,
  sanitizarClientePresupuesto,
  snapshotDesdeBom,
  snapshotDesdeItemsVentas,
} from '@/lib/netvision/clientePresupuesto'
import { bomDelProyecto } from '@/lib/netvision/services/configGenerator'

describe('oferta del cliente desde Ventas', () => {
  const items = [
    {
      product_id: 10,
      product_data: { nombre: 'Cámara EZVIZ H3 3K', costo: 50, precio: 60 },
      qty: 2,
      unit_price: 72,
    },
    {
      product_id: -1,
      product_data: { nombre: 'Adaptador PoE (splitter) de 12 V', costo: 6, precio: 6 },
      qty: 2,
      unit_price: 7.2,
    },
  ]

  it('arma renglones de venta y tira costo, id y margen', () => {
    const snap = snapshotDesdeItemsVentas({
      items,
      subtotal: 158.4,
      notas: 'Generado desde NetVision: Casa Pérez.\nCanalización a cargo de otro contratista.',
      moneda: 'USD',
    })
    assert.ok(snap)
    assert.equal(snap!.renglones.length, 2)
    assert.equal(snap!.renglones[0]!.descripcion, 'Cámara ezviz h3 3k')
    assert.equal(snap!.renglones[0]!.qty, 2)
    assert.equal(snap!.renglones[0]!.unitUsd, 72)
    assert.equal(snap!.subtotalUsd, 158.4)
    assert.equal(snap!.nota, 'Canalización a cargo de otro contratista.')
    const json = JSON.stringify(snap)
    assert.equal(json.includes('costo'), false)
    assert.equal(json.includes('product_id'), false)
    assert.equal(json.includes('margen'), false)
    assert.equal(json.includes('50'), false)
  })

  it('sin renglones válidos no hay oferta', () => {
    assert.equal(snapshotDesdeItemsVentas({ items: [], moneda: 'USD' }), null)
    assert.equal(snapshotDesdeItemsVentas({ items: [{ qty: 0, unit_price: 10 }], moneda: 'USD' }), null)
  })

  it('sanitiza basura que alguien meta en el JSON', () => {
    const sucio = {
      publicadoAt: '2026-10-07T12:00:00.000Z',
      moneda: 'USD',
      renglones: [{ descripcion: 'H3', qty: 1, unitUsd: 72, costo: 50, margen: 20 }],
      subtotalUsd: 72,
      total_cost: 50,
      ventasBudgetId: 'secreto',
      nota: 'Generado desde NetVision: X.\nZanja a cargo de otro.',
    }
    const limpio = sanitizarClientePresupuesto(sucio)!
    assert.equal(limpio.renglones[0]!.descripcion, 'H3')
    assert.equal(limpio.subtotalUsd, 72)
    assert.equal('total_cost' in limpio, false)
    assert.equal('ventasBudgetId' in limpio, false)
    assert.equal(limpio.nota, 'Zanja a cargo de otro.')
  })

  it('el enlace del cliente lleva la oferta y no el id de Ventas', () => {
    const snap = snapshotDesdeItemsVentas({ items, subtotal: 158.4, moneda: 'USD' })
    const p = {
      ...emptyProject({ id: 'p1', name: 'Casa Pérez' }),
      ventasBudgetId: 'bud-interno',
      clientePresupuesto: snap!,
      description: 'interno',
      distributorMarginPct: 30,
    }
    const c = proyectoParaCliente(p)
    assert.equal(c.ventasBudgetId, undefined)
    assert.equal(c.distributorMarginPct, 0)
    assert.ok(hayOfertaCliente(c))
    assert.equal(c.clientePresupuesto?.renglones.length, 2)
    assert.equal(c.clientePresupuesto?.renglones[0]!.unitUsd, 72)
    assert.equal(p.ventasBudgetId, 'bud-interno')
  })

  it('se conserva al cargar el proyecto y se descarta si está vacío', () => {
    const snap = snapshotDesdeItemsVentas({ items, subtotal: 158.4, moneda: 'USD' })
    const p = projectFromPartial({ id: 'p', clientePresupuesto: snap })
    assert.equal(p.clientePresupuesto?.renglones.length, 2)
    assert.equal(projectFromPartial({ id: 'p', clientePresupuesto: { renglones: [] } }).clientePresupuesto, undefined)
  })

  it('filtra la nota interna de NetVision', () => {
    assert.equal(notaParaCliente('Generado desde NetVision: Casa.'), undefined)
    assert.equal(notaParaCliente('  '), undefined)
  })

  it('acepta renglones de Ventas con name / quantity / unitPrice', () => {
    const snap = snapshotDesdeItemsVentas({
      items: [
        { product: { name: 'Cámara H9c Dual 2K' }, quantity: 2, unitPrice: 89 },
        { nombre: 'Cable Cat 6 (por metro)', qty: 40, precio: 0.4 },
      ],
      subtotal: 194,
      moneda: 'USD',
    })
    assert.ok(snap)
    assert.equal(snap!.renglones.length, 2)
    assert.equal(snap!.renglones[0]!.descripcion, 'Cámara h9c dual 2k')
    assert.equal(snap!.renglones[0]!.qty, 2)
    assert.equal(snap!.renglones[0]!.unitUsd, 89)
    assert.equal(snap!.renglones[1]!.qty, 40)
    assert.equal(snap!.renglones[1]!.unitUsd, 0.4)
  })

  it('arma la oferta del cliente desde el listado del plano si no hay Ventas', () => {
    const bom = {
      lines: [
        {
          sku: 'ezviz-h9c',
          category: 'camera' as const,
          description: 'Ezviz H9c Dual 2K',
          qty: 2,
          unitUsd: 80,
          totalUsd: 160,
        },
      ],
    }
    const snap = snapshotDesdeBom(
      { name: 'Proyecto CCS', currency: 'USD', distributorMarginPct: 25 },
      bom,
    )
    assert.ok(snap)
    assert.equal(snap!.renglones.length, 1)
    assert.equal(snap!.renglones[0]!.qty, 2)
    assert.equal(snap!.renglones[0]!.unitUsd, 100)
    assert.equal(snap!.subtotalUsd, 200)
  })

  it('un proyecto con cámaras produce oferta aunque no tenga id de Ventas', () => {
    const p = emptyProject({ id: 'p-ccs', name: 'Proyecto CCS' })
    p.cameras = [
      {
        id: 'c1',
        label: 'CAM-01',
        x: 0.2,
        y: 0.3,
        modelId: 'ezviz-h9c',
        yawDeg: 0,
        mountHeightM: 3,
      },
    ]
    assert.equal(p.ventasBudgetId, undefined)
    const snap = snapshotDesdeBom(p, bomDelProyecto(p))
    assert.ok(snap)
    assert.ok((snap!.renglones.length ?? 0) > 0)
    assert.ok(snap!.renglones.some((r) => /h9c/i.test(r.descripcion)))
    assert.ok(snap!.subtotalUsd > 0)
  })
})
