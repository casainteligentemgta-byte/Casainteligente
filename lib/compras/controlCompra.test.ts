import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import {
  compararPedidoFacturadoRecibido,
  compararPrecioReferencia,
  mediana,
  precioUnitarioUsd,
  lineaDiferencia,
  revisarControlCompra,
  type Diferencia,
} from './controlCompra'

const ped = (material_id: string | null, cantidad: number, unidad = 'SAC', procura_id = 'p1') => ({
  procura_id,
  material_id,
  descripcion: material_id ?? 'Texto libre',
  cantidad,
  unidad,
})
const fac = (material_id: string | null, cantidad: number, precio = 10, unidad = 'SAC', descripcion = material_id ?? 'x') => ({
  material_id,
  descripcion,
  cantidad,
  unidad,
  precio_unitario: precio,
})

describe('control pedido / facturado / recibido', () => {
  it('todo cuadra: sin diferencias', () => {
    const r = compararPedidoFacturadoRecibido({
      pedidas: [ped('cem', 50)],
      facturadas: [fac('cem', 50)],
      recibidas: new Map([['cem', 50]]),
    })
    assert.deepEqual(r, [])
  })

  it('facturó más de lo pedido (con el monto del exceso)', () => {
    const [d] = compararPedidoFacturadoRecibido({ pedidas: [ped('cem', 50)], facturadas: [fac('cem', 60, 10)] })
    assert.equal(d.tipo, 'facturado_mayor_pedido')
    assert.equal(d.cantidad_pedida, 50)
    assert.equal(d.monto_diferencia, 100)
    assert.equal(d.procura_id, 'p1')
  })

  it('tolera redondeos de 2 %', () => {
    assert.deepEqual(compararPedidoFacturadoRecibido({ pedidas: [ped('cem', 100)], facturadas: [fac('cem', 101)] }), [])
  })

  it('suma varias líneas del mismo material y varias procuras', () => {
    const r = compararPedidoFacturadoRecibido({
      pedidas: [ped('cem', 30, 'SAC', 'p1'), ped('cem', 20, 'SAC', 'p2')],
      facturadas: [fac('cem', 25), fac('cem', 25)],
    })
    assert.deepEqual(r, [])
  })

  it('material que nadie pidió', () => {
    const [d] = compararPedidoFacturadoRecibido({
      pedidas: [ped('cem', 50)],
      facturadas: [fac('cem', 50), fac('whisky', 2, 30)],
    })
    assert.equal(d.tipo, 'no_pedido')
    assert.equal(d.monto_diferencia, 60)
  })

  it('no marca «no pedido» si alguna procura es de texto libre (no hay certeza)', () => {
    const r = compararPedidoFacturadoRecibido({
      pedidas: [ped(null, 50)],
      facturadas: [fac('cem', 50)],
    })
    assert.deepEqual(r, [])
  })

  it('no compara unidades distintas', () => {
    assert.deepEqual(
      compararPedidoFacturadoRecibido({ pedidas: [ped('cem', 2, 'SAC')], facturadas: [fac('cem', 85, 1, 'KG')] }),
      [],
    )
  })

  it('factura sin procura: solo se controla lo recibido', () => {
    const r = compararPedidoFacturadoRecibido({
      pedidas: [],
      facturadas: [fac('cem', 50, 10)],
      recibidas: new Map([['cem', 40]]),
    })
    assert.equal(r.length, 1)
    assert.equal(r[0].tipo, 'recibido_menor_facturado')
    assert.equal(r[0].cantidad_recibida, 40)
    assert.equal(r[0].monto_diferencia, 100)
  })

  it('todo rechazado: recibido 0', () => {
    const [d] = compararPedidoFacturadoRecibido({ pedidas: [], facturadas: [fac('cem', 5)], recibidas: new Map() })
    assert.equal(d.cantidad_recibida, 0)
    assert.equal(d.monto_diferencia, 50)
  })

  it('sin recepción cerrada no evalúa lo recibido', () => {
    assert.deepEqual(compararPedidoFacturadoRecibido({ pedidas: [], facturadas: [fac('cem', 5)] }), [])
  })

  it('el aviso se lee claro', () => {
    const d: Diferencia = {
      tipo: 'recibido_menor_facturado',
      clave: 'k',
      procura_id: null,
      material_id: 'cem',
      descripcion: 'Cemento gris',
      unidad: 'SAC',
      cantidad_pedida: null,
      cantidad_facturada: 50,
      cantidad_recibida: 40,
      precio_unitario: 10,
      monto_diferencia: 100,
    }
    assert.match(lineaDiferencia(d, 'VES'), /facturado 50 SAC, recibido 40 SAC · <b>100 VES<\/b>/)
  })
})

describe('revisarControlCompra (guardado y aviso)', () => {
  function sb() {
    return crearFakeSupabase({
      purchase_invoices: [{ id: 'f1', invoice_number: 'A-1', supplier_name: 'Ferre', moneda: 'VES', proyecto_id: null }],
      contabilidad_compras: [{ id: 'c1', purchase_invoice_id: 'f1', procura_id: 'p1', moneda: 'VES', proyecto_id: null }],
      contabilidad_compra_lineas: [
        { compra_id: 'c1', material_id: 'cem', descripcion: 'Cemento', cantidad: 60, unidad: 'SAC', precio_unitario: 10 },
      ],
      ci_procuras: [{ id: 'p1', material_id: 'cem', material_txt: 'Cemento', cantidad: 50, cantidad_compra: null, unidad: 'SAC', purchase_invoice_id: 'f1' }],
      quality_inspections: [{ invoice_id: 'f1', status: 'APROBADO', material_id: 'cem', quantity: 55 }],
      ci_control_compras: [],
    }) as unknown as SupabaseClient & { tablas: Record<string, unknown[]> }
  }

  it('guarda cada diferencia una sola vez y avisa solo las nuevas', async () => {
    const db = sb()
    const avisos: Diferencia[][] = []
    const avisar = async (ds: Diferencia[]) => {
      avisos.push(ds)
      return 1
    }

    const r1 = await revisarControlCompra(db, 'f1', { avisar })
    assert.equal(r1.nuevas, 1, 'al confirmar: facturó más de lo pedido')
    assert.equal(avisos[0][0].tipo, 'facturado_mayor_pedido')

    const r2 = await revisarControlCompra(db, 'f1', { recepcion: true, avisar })
    assert.equal(r2.diferencias, 2)
    assert.equal(r2.nuevas, 1, 'al recibir solo es nueva la de lo recibido')
    assert.equal(avisos[1][0].tipo, 'recibido_menor_facturado')
    assert.equal(avisos[1][0].cantidad_recibida, 55)

    const r3 = await revisarControlCompra(db, 'f1', { recepcion: true, avisar })
    assert.equal(r3.nuevas, 0, 'repetir no vuelve a avisar')
    assert.equal(db.tablas.ci_control_compras.length, 2)
  })

  it('el conteo del depositario manda sobre lo aprobado', async () => {
    const db = sb()
    const r = await revisarControlCompra(db, 'f1', {
      cantidadesRecibidas: [{ material_id: 'cem', cantidad: 60 }],
      avisar: async () => 0,
    })
    assert.equal(r.diferencias, 1, 'solo «facturó más de lo pedido»; lo recibido cuadra con el conteo')
  })
})

describe('precio de referencia', () => {
  it('mediana ignora una compra rara', () => {
    assert.equal(mediana([10, 11, 50]), 11)
    assert.equal(mediana([10, 12]), 11)
    assert.equal(mediana([]), null)
  })

  it('USD directo; Bs con su tasa', () => {
    assert.equal(precioUnitarioUsd(12, 'USD', null), 12)
    assert.equal(precioUnitarioUsd(1200, 'VES', 100), 12)
    assert.equal(precioUnitarioUsd(1200, 'VES', null), null)
  })

  it('avisa solo por encima del 15 %', () => {
    const refs = new Map([['cem', 10]])
    const l = (precio_usd: number) => [{ material_id: 'cem', descripcion: 'Cemento', unidad: 'SAC', cantidad: 10, precio_usd }]
    assert.deepEqual(compararPrecioReferencia(l(11.4), refs), [])
    const [d] = compararPrecioReferencia(l(12.5), refs)
    assert.equal(d.tipo, 'precio_alto')
    assert.equal(d.precio_referencia, 10)
    assert.equal(d.monto_diferencia, 25)
    assert.match(lineaDiferencia(d, 'USD'), /pagado 12,5 USD\/SAC, referencia 10 USD\/SAC \(\+25 %\)/)
  })

  it('sin historial no hay alarma', () => {
    assert.deepEqual(
      compararPrecioReferencia([{ material_id: 'x', descripcion: 'x', unidad: 'UND', cantidad: 1, precio_usd: 99 }], new Map()),
      [],
    )
  })

  it('con la base: compara con compras anteriores en USD aunque fueran en Bs', async () => {
    const db = crearFakeSupabase({
      purchase_invoices: [{ id: 'f2', invoice_number: 'B-2', supplier_name: 'Ferre', moneda: 'VES', proyecto_id: null }],
      contabilidad_compras: [
        { id: 'c0', purchase_invoice_id: 'f0', moneda: 'VES', tasa_bcv_ves_por_usd: 100, fecha: new Date().toISOString().slice(0, 10), cco_estado: null },
        { id: 'c2', purchase_invoice_id: 'f2', moneda: 'VES', tasa_bcv_ves_por_usd: 200, procura_id: null, proyecto_id: null },
      ],
      contabilidad_compra_lineas: [
        { compra_id: 'c0', material_id: 'cem', descripcion: 'Cemento', cantidad: 10, unidad: 'SAC', precio_unitario: 1000, created_at: '2026-09-01' },
        { compra_id: 'c2', material_id: 'cem', descripcion: 'Cemento', cantidad: 10, unidad: 'SAC', precio_unitario: 2600, created_at: '2026-10-16' },
      ],
      ci_procuras: [],
      ci_control_compras: [],
    }) as unknown as SupabaseClient
    const avisos: Diferencia[][] = []
    const r = await revisarControlCompra(db, 'f2', { avisar: async (ds) => { avisos.push(ds); return 1 } })
    // antes 1000 Bs a 100 = 10 USD; ahora 2600 Bs a 200 = 13 USD → +30 %
    assert.equal(r.nuevas, 1)
    assert.equal(avisos[0][0].tipo, 'precio_alto')
    assert.equal(avisos[0][0].precio_referencia, 10)
    assert.equal(avisos[0][0].precio_unitario, 13)
  })
})
