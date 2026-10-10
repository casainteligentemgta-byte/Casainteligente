import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { apiRequiereSesion, requiereSesion } from './rutasAcceso'

describe('rutas que piden sesión', () => {
  it('el catálogo de productos y los presupuestos piden sesión', () => {
    for (const ruta of ['/productos', '/productos/12/editar', '/ventas', '/almacen', '/almacen/nuevo']) {
      assert.equal(requiereSesion(ruta), true, ruta)
    }
  })

  it('la demostración del presupuesto sigue abierta', () => {
    assert.equal(requiereSesion('/ventas/preview'), false)
  })

  it('lo público sigue público', () => {
    for (const ruta of [
      '/',
      '/login',
      '/registro',
      '/reclutamiento',
      '/nexus/vision/cliente',
      '/talento/examen/abc',
      '/presupuesto/demo',
    ]) {
      assert.equal(requiereSesion(ruta), false, ruta)
    }
  })

  it('lo que ya pedía sesión la sigue pidiendo', () => {
    for (const ruta of [
      '/contabilidad',
      '/admin/dashboard',
      '/proyectos/1',
      '/rrhh',
      '/reclutamiento/hoja-de-vida/view',
      '/reclutamiento/hoja-de-vida/view/7',
    ]) {
      assert.equal(requiereSesion(ruta), true, ruta)
    }
    // /rrhh/registro es el formulario público de RR. HH.
    assert.equal(requiereSesion('/rrhh/registro'), false)
    // No confunde prefijos parecidos.
    assert.equal(requiereSesion('/productos-publicos'), false)
    assert.equal(requiereSesion('/ventasx'), false)
  })
})

describe('páginas de personal que leen tablas cerradas', () => {
  it('clientes, tablero, flota y personas piden sesión', () => {
    for (const ruta of ['/clientes', '/clientes/crm', '/dashboard', '/dashboard/contracts', '/flota/gasolina', '/personas']) {
      assert.equal(requiereSesion(ruta), true, ruta)
    }
  })
})

describe('quién puede usar el bot', () => {
  it('la lista de chats autorizados pide sesión; el webhook de Telegram no', () => {
    assert.equal(apiRequiereSesion('/api/telegram/whitelist'), true)
    assert.equal(apiRequiereSesion('/api/telegram/whitelist/abc'), true)
    assert.equal(apiRequiereSesion('/api/telegram'), false)
    assert.equal(apiRequiereSesion('/api/telegram/registrar-webhook'), false)
    assert.equal(apiRequiereSesion('/api/webhooks/telegram'), false)
    assert.equal(apiRequiereSesion('/api/webhook-logs'), false)
  })
})

describe('APIs que piden sesión', () => {
  it('almacén, compras, procuras y facturas del canal la piden', () => {
    for (const ruta of [
      '/api/almacen/transferencias',
      '/api/almacen/stock',
      '/api/almacen/inventario/abc/stock',
      '/api/compras/procuras',
      '/api/compras/usuarios-telegram/7',
      '/api/procuras',
      '/api/procuras/procesar-lote',
      '/api/facturas-canal/pendientes/1/ingreso-almacen',
      '/api/contabilidad/compras/9/ingreso-almacen',
    ]) {
      assert.equal(apiRequiereSesion(ruta), true, ruta)
    }
  })

  it('el bot, los cron y lo público no se tocan', () => {
    for (const ruta of [
      '/api/webhooks/telegram',
      '/api/telegram',
      '/api/webhooks/whatsapp',
      '/api/cron/weekly-report',
      '/api/health/supabase',
      '/api/recruitment/needs',
      '/api/talento/examen/submit',
      '/api/contabilidad/cco/emparejar-soportes',
      '/api/almacenes-publicos',
    ]) {
      assert.equal(apiRequiereSesion(ruta), false, ruta)
    }
  })
})
