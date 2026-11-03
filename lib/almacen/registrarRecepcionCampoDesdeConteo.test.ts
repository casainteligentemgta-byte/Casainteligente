import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase'
import {
  documentarConteoDepositarioTrasIngresoCanal,
  registrarRecepcionCampoDesdeConteo,
} from '@/lib/almacen/registrarRecepcionCampoDesdeConteo'

const OBRA = '11111111-1111-4111-8111-111111111111'
const UB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const MAT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PEND = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

describe('registrarRecepcionCampoDesdeConteo', () => {
  it('escribe encabezado y líneas sin tocar stock', async () => {
    const db = crearFakeSupabase({
      inventario_stock: [{ ubicacion_id: UB, material_id: MAT, cantidad_disponible: 4 }],
    })
    const r = await registrarRecepcionCampoDesdeConteo(db as unknown as SupabaseClient, {
      proyectoId: OBRA,
      ubicacionId: UB,
      pendienteCanalId: PEND,
      proveedorNombre: 'Ferretería Sur',
      numDoc: 'F-88',
      lineas: [{ material_id: MAT, cantidad: 2, unidad: 'SACO', descripcion: 'Cemento' }],
    })
    assert.equal(r.ok, true)
    const rec = db.tablas.ci_recepciones_campo[0]
    assert.equal(rec.tipo, 'factura_canal')
    assert.equal(rec.factura_canal_pendiente_id, PEND)
    assert.equal(rec.contabilidad_sync_pendiente, false)
    assert.equal(db.tablas.ci_recepciones_campo_lineas.length, 1)
    assert.equal(Number(db.tablas.inventario_stock[0].cantidad_disponible), 4)
  })

  it('es idempotente por factura del canal', async () => {
    const db = crearFakeSupabase({
      ci_recepciones_campo: [{ id: 'rec-1', factura_canal_pendiente_id: PEND }],
    })
    const r = await registrarRecepcionCampoDesdeConteo(db as unknown as SupabaseClient, {
      proyectoId: OBRA,
      ubicacionId: UB,
      pendienteCanalId: PEND,
      lineas: [{ material_id: MAT, cantidad: 1 }],
    })
    assert.deepEqual(r, { ok: true, recepcionId: 'rec-1', yaExistia: true })
    assert.equal(db.tablas.ci_recepciones_campo.length, 1)
  })
})

describe('documentarConteoDepositarioTrasIngresoCanal', () => {
  it('documenta el conteo de una factura precargada', async () => {
    const db = crearFakeSupabase({
      ci_facturas_canal_pendientes: [
        {
          id: PEND,
          proyecto_id: OBRA,
          ubicacion_destino_id: UB,
          purchase_invoice_id: 'inv-1',
        },
      ],
      contabilidad_compras: [
        {
          purchase_invoice_id: 'inv-1',
          proyecto_id: OBRA,
          ubicacion_destino_id: UB,
          supplier_name: 'Ferretería Sur',
          invoice_number: 'F-88',
        },
      ],
      global_inventory: [{ id: MAT, name: 'Cemento gris', unit: 'SACO' }],
    })
    await documentarConteoDepositarioTrasIngresoCanal(db as unknown as SupabaseClient, PEND, {
      purchaseInvoiceId: 'inv-1',
      cantidadesRecibidas: [{ material_id: MAT, cantidad: 5 }],
    })
    assert.equal(db.tablas.ci_recepciones_campo.length, 1)
    assert.equal(db.tablas.ci_recepciones_campo_lineas[0].material_id, MAT)
    assert.equal(Number(db.tablas.ci_recepciones_campo_lineas[0].cantidad), 5)
  })
})
