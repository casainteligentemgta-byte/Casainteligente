import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { requiereSesion } from './rutasAcceso'

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
