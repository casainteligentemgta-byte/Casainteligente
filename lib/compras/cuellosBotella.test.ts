import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import { calcularCuellosBotella, enviarAvisosCuellosBotella, materialesBajoMinimo, textoEdad } from './cuellosBotella'

const AHORA = new Date('2026-10-15T12:00:00Z')
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()
const OBRA = '11111111-1111-4111-8111-111111111111'

function base() {
  return crearFakeSupabase({
    ci_proyectos: [{ id: OBRA, nombre: 'RANCHO', nombre_proyecto: 'RANCHO' }],
    ci_procuras: [
      // por aprobar, dentro del plazo (24 h)
      { id: 'p1', ticket: 'PR-1', estado: 'solicitada', material_txt: 'Arena', cantidad: 2, unidad: 'm3', proyecto_id: OBRA, updated_at: haceHoras(5) },
      // aprobada hace 3 días: detenida (plazo 48 h), no crítica (< 96 h)
      { id: 'p2', ticket: 'PR-2', estado: 'aprobada', material_txt: 'Cemento', cantidad: 10, unidad: 'saco', proyecto_id: OBRA, updated_at: haceHoras(72) },
      // aprobada hace 5 días: crítica
      { id: 'p3', ticket: 'PR-3', estado: 'aprobada_directa', material_txt: 'Cabilla', cantidad: 5, unidad: 'und', proyecto_id: OBRA, updated_at: haceHoras(120) },
      // cerrada: no cuenta
      { id: 'p4', ticket: 'PR-4', estado: 'cancelada', material_txt: 'X', proyecto_id: OBRA, updated_at: haceHoras(900) },
    ],
    quality_inspections: [
      { id: 'q1', invoice_id: 'f1', quantity: 3, status: 'PENDIENTE', created_at: haceHoras(60), purchase_invoices: { invoice_number: 'A-1', supplier_name: 'Ferre', proyecto_id: OBRA } },
      { id: 'q2', invoice_id: 'f1', quantity: 1, status: 'PENDIENTE', created_at: haceHoras(50), purchase_invoices: { invoice_number: 'A-1', supplier_name: 'Ferre', proyecto_id: OBRA } },
      { id: 'q3', invoice_id: 'f2', quantity: 1, status: 'APROBADO', created_at: haceHoras(500), purchase_invoices: { invoice_number: 'B', supplier_name: 'Y', proyecto_id: OBRA } },
    ],
    ci_compras_retiros: [
      { id: 'r1', estado: 'pendiente', proyecto_id: OBRA, numero_factura: 'A-1', proveedor_nombre: 'Ferre', solicitado_por_chat_id: 900, created_at: haceHoras(30) },
      { id: 'r2', estado: 'en_camino', proyecto_id: OBRA, numero_factura: 'C', proveedor_nombre: 'Z', transportista_nombre: 'Luis', created_at: haceHoras(80), retirado_at: haceHoras(2) },
    ],
    inv_requerimientos_salida: [],
    ci_facturas_canal_pendientes: [
      { id: 'c1', estado: 'procesando', chat_id: '700', proyecto_id: null, extracted: null, created_at: haceHoras(40), updated_at: haceHoras(40) },
      { id: 'c2', estado: 'confirmado', chat_id: '700', created_at: haceHoras(400), updated_at: haceHoras(400) },
    ],
    ci_proyecto_nomina: [
      { id: 'n1', proyecto_id: OBRA, rol: 'comprador', categoria: 'empleado', activo: true, telegram_chat_id: 101, nombre: 'Ana' },
      { id: 'n2', proyecto_id: OBRA, rol: 'depositario', categoria: 'empleado', activo: true, telegram_chat_id: 201, nombre: 'Dep 1' },
      { id: 'n3', proyecto_id: OBRA, rol: 'depositario', categoria: 'empleado', activo: true, telegram_chat_id: 202, nombre: 'Dep 2' },
    ],
  }) as unknown as SupabaseClient
}

describe('cuellos de botella', () => {
  it('ubica cada pendiente en su etapa y marca detenidos y críticos', async () => {
    const r = await calcularCuellosBotella(base(), { ahora: AHORA })
    const etapa = (k: string) => r.etapas.find((e) => e.clave === k)!

    assert.equal(etapa('aprobacion').items.length, 1)
    assert.equal(etapa('aprobacion').detenidos, 0)

    assert.equal(etapa('compra').items.length, 2)
    assert.equal(etapa('compra').detenidos, 2)
    assert.equal(etapa('compra').criticos, 1)
    assert.equal(etapa('compra').items[0].referencia, 'PR-3', 'el más viejo primero')
    assert.equal(etapa('compra').items[0].obra, 'RANCHO')

    // cuarentena agrupada por factura, desde la línea más vieja
    assert.equal(etapa('cuarentena').items.length, 1)
    assert.equal(Math.round(etapa('cuarentena').items[0].horas), 60)
    assert.match(etapa('cuarentena').items[0].detalle, /2 línea/)

    assert.equal(etapa('retiro').detenidos, 1)
    // en camino: cuenta desde que se retiró (2 h), no desde que se creó
    assert.equal(etapa('transporte').detenidos, 0)

    assert.equal(etapa('canal').detenidos, 1)
    assert.equal(r.totalDetenidos, 5)
  })

  it('filtra por obra', async () => {
    const r = await calcularCuellosBotella(base(), { ahora: AHORA, proyectoId: OBRA })
    assert.equal(r.etapas.find((e) => e.clave === 'canal')!.items.length, 0)
  })

  it('un mensaje por persona; todos los depositarios reciben la cuarentena', async () => {
    const sb = base()
    const enviados: Array<{ chat: string; html: string }> = []
    const resumen = await calcularCuellosBotella(sb, { ahora: AHORA })
    const res = await enviarAvisosCuellosBotella(sb, {
      resumen,
      baseUrl: 'https://x.test',
      enviar: async (chat, html) => {
        enviados.push({ chat, html })
      },
    })
    const de = (chat: string) => enviados.filter((e) => e.chat === chat)

    assert.equal(res.detenidos, 5)
    for (const c of ['101', '201', '202', '700']) assert.equal(de(c).length, 1, `un aviso para ${c}`)

    // comprador: compra detenida + retiro sin tomar
    assert.match(de('101')[0].html, /PR-2/)
    assert.match(de('101')[0].html, /Mercancía por retirar/)
    // ambos depositarios
    assert.match(de('201')[0].html, /Factura A-1/)
    assert.match(de('202')[0].html, /Factura A-1/)
    // quien mandó la factura que se trabó
    assert.match(de('700')[0].html, /lectura trabada/)
    assert.match(de('700')[0].html, /x\.test\/compras\/torre-control/)
  })

  it('edad legible', () => {
    assert.equal(textoEdad(5), '5 h')
    assert.equal(textoEdad(24), '1 día')
    assert.equal(textoEdad(73), '3 días')
  })
})

describe('stock bajo el mínimo y en cotización', () => {
  const MAT_A = 'aaaaaaaa-0000-4000-8000-000000000001'
  const MAT_B = 'aaaaaaaa-0000-4000-8000-000000000002'
  const MAT_C = 'aaaaaaaa-0000-4000-8000-000000000003'
  const UB = 'ub-rancho'
  const sb = () =>
    crearFakeSupabase({
      ci_proyectos: [{ id: OBRA, nombre: 'RANCHO' }],
      ci_procuras: [
        // aprobada hace 3 días pero el comprador marcó «cotizando» hace 1 día: no detenida
        { id: 'p1', ticket: 'PR-1', estado: 'aprobada', material_txt: 'Cemento', proyecto_id: OBRA, updated_at: haceHoras(72), cotizando_at: haceHoras(24), cotizando_por: 'Neo' },
        // ya tiene procura abierta: no se avisa como stock bajo
        { id: 'p2', ticket: 'PR-2', estado: 'solicitada', material_id: MAT_B, material_txt: 'Arena', proyecto_id: OBRA, updated_at: haceHoras(1) },
      ],
      ci_inventario_reorden_obra: [
        { proyecto_id: OBRA, material_id: MAT_A, reorder_point: 10 },
        { proyecto_id: OBRA, material_id: MAT_B, reorder_point: 10 },
        { proyecto_id: OBRA, material_id: MAT_C, reorder_point: 5 },
      ],
      global_inventory: [
        { id: MAT_A, name: 'Cabilla 1/2', unit: 'und', reorder_point: 0, is_active: true },
        { id: MAT_B, name: 'Arena lavada', unit: 'm3', reorder_point: 0, is_active: true },
        { id: MAT_C, name: 'Clavo 3"', unit: 'kg', reorder_point: 0, is_active: true },
      ],
      inv_ubicaciones: [{ id: UB, ci_proyecto_id: OBRA, tipo: 'almacen_central' }, { id: 'ub-frente', ci_proyecto_id: OBRA, tipo: 'obra' }],
      inventario_stock: [
        { material_id: MAT_A, ubicacion_id: UB, cantidad_disponible: 3, cantidad_en_transito_entrante: 2, updated_at: haceHoras(10) },
        { material_id: MAT_B, ubicacion_id: UB, cantidad_disponible: 0, cantidad_en_transito_entrante: 0, updated_at: haceHoras(10) },
        { material_id: MAT_C, ubicacion_id: UB, cantidad_disponible: 8, cantidad_en_transito_entrante: 0, updated_at: haceHoras(10) },
        // ya despachado al frente de obra: no cuenta como disponible
        { material_id: MAT_A, ubicacion_id: 'ub-frente', cantidad_disponible: 50, cantidad_en_transito_entrante: 0, updated_at: haceHoras(10) },
      ],
    }) as unknown as SupabaseClient

  it('avisa lo que quedó bajo el mínimo sin procura abierta', async () => {
    const r = await calcularCuellosBotella(sb(), { ahora: AHORA })
    const stock = r.etapas.find((e) => e.clave === 'stock')!
    assert.equal(stock.items.length, 1)
    assert.equal(stock.items[0].referencia, 'Cabilla 1/2')
    assert.match(stock.items[0].detalle, /quedan 3 und \(\+2 en camino\) · mínimo 10 und/)
    assert.equal(stock.items[0].detenido, true)
    assert.equal(stock.items[0].critico, false)
  })

  it('«en cotización» da más plazo y lo muestra', async () => {
    const r = await calcularCuellosBotella(sb(), { ahora: AHORA })
    const compra = r.etapas.find((e) => e.clave === 'compra')!
    assert.equal(compra.items.length, 1)
    assert.equal(compra.items[0].detenido, false)
    assert.match(compra.items[0].detalle, /en cotización por Neo/)
  })
})

describe('materialesBajoMinimo', () => {
  it('agotado y mínimo global', () => {
    const bajos = materialesBajoMinimo(
      [{ materialId: 'm1', proyectoId: null, minimo: 4, nombre: 'X', unidad: 'und' }],
      [
        { materialId: 'm1', proyectoId: 'o1', disponible: 1, transito: 0, updatedAt: 'a' },
        { materialId: 'm1', proyectoId: 'o2', disponible: 2, transito: 0, updatedAt: 'b' },
      ],
      [],
    )
    assert.equal(bajos.length, 1)
    assert.equal(bajos[0].disponible, 3)
    assert.equal(bajos[0].desde, 'b')
    assert.equal(materialesBajoMinimo([{ materialId: 'm1', proyectoId: null, minimo: 3, nombre: '', unidad: '' }], [
      { materialId: 'm1', proyectoId: 'o1', disponible: 3, transito: 0, updatedAt: '' },
    ], []).length, 0)
  })
})

describe('antigüedad de la procura', () => {
  it('cuenta desde el último cambio de estado, no desde la última edición', async () => {
    const sb = crearFakeSupabase({
      ci_procuras: [
        // editada hace 1 h (p. ej. el ticket del solicitante), aprobada hace 72 h
        { id: 'p1', ticket: 'PR-1', estado: 'aprobada', material_txt: 'Cemento', proyecto_id: OBRA, created_at: haceHoras(100), updated_at: haceHoras(1) },
      ],
      ci_procura_estados_historial: [
        { procura_id: 'p1', estado_nuevo: 'solicitada', created_at: haceHoras(100) },
        { procura_id: 'p1', estado_nuevo: 'aprobada', created_at: haceHoras(72) },
      ],
    }) as unknown as SupabaseClient
    const r = await calcularCuellosBotella(sb, { ahora: AHORA })
    const it = r.etapas.find((e) => e.clave === 'compra')!.items[0]!
    assert.equal(Math.round(it.horas), 72)
    assert.equal(it.detenido, true)
  })
})
