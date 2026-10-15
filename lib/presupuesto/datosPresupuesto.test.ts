import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { avisoEditarAceptado, fechaHoraPresupuesto, numeroPresupuesto, rutaVistaPrevia } from './datosPresupuesto'

describe('número y fechas del presupuesto', () => {
  it('el número lo pone la base: sin guardar es un borrador', () => {
    assert.equal(numeroPresupuesto(523), 'P-523')
    assert.equal(numeroPresupuesto('600'), 'P-600')
    assert.equal(numeroPresupuesto(null), 'Borrador')
    assert.equal(numeroPresupuesto(''), 'Borrador')
    assert.equal(numeroPresupuesto('abc'), 'Borrador')
  })

  it('fecha y hora en Venezuela', () => {
    const t = fechaHoraPresupuesto('2026-10-13T16:00:00Z')
    assert.match(t, /13/)
    assert.match(t, /2026/)
    assert.match(t, /12:00/) // 16:00 UTC = 12:00 en Caracas
    assert.equal(fechaHoraPresupuesto(null), '')
    assert.equal(fechaHoraPresupuesto('no es fecha'), '')
  })
})

describe('vista previa', () => {
  it('con cambios sin guardar muestra lo que hay en pantalla; si no, lo guardado', () => {
    assert.equal(rutaVistaPrevia('abc-1', false), '/ventas/preview?id=abc-1')
    assert.equal(rutaVistaPrevia('abc-1', true), '/ventas/preview?id=abc-1&borrador=1')
    assert.equal(rutaVistaPrevia(null, true), '/ventas/preview?borrador=1')
    assert.equal(rutaVistaPrevia('', false), '/ventas/preview?borrador=1')
  })
})

describe('editar un presupuesto ya aceptado', () => {
  it('avisa solo si el cliente ya lo aceptó', () => {
    assert.match(avisoEditarAceptado('pagado', 512) ?? '', /^P-512 ya fue aceptado por el cliente \(pagado\)/)
    assert.match(avisoEditarAceptado('cobrado', 512) ?? '', /por pagar/)
    assert.equal(avisoEditarAceptado('enviado', 512), null)
    assert.equal(avisoEditarAceptado('no_aprobado', 512), null)
  })
})
