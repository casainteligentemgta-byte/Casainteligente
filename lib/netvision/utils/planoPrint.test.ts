import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLANO_PRINT_PATH,
  buildPlanoPrintMeta,
  capitalizeLabel,
  labelEquiposRed,
  labelMuros,
  planoPrintHref,
} from './planoPrint'

describe('planoPrint', () => {
  it('arma la ficha del plano con cámaras y estructuras', () => {
    const meta = buildPlanoPrintMeta({
      planoNombre: 'Santa Fe planta baja',
      cameraCount: 13,
      networkCount: 0,
      structureCount: 29,
    })
    assert.match(meta, /Santa Fe/)
    assert.match(meta, /13 cámaras/)
    assert.match(meta, /0 equipos de red/)
    assert.match(meta, /29 muros/)
  })

  it('nombra equipos de red y muros en singular y plural', () => {
    assert.equal(labelEquiposRed(1), 'equipo de red')
    assert.equal(labelEquiposRed(2), 'equipos de red')
    assert.equal(labelMuros(1), 'muro')
    assert.equal(labelMuros(29), 'muros')
    assert.equal(capitalizeLabel('equipos de red'), 'Equipos de red')
  })

  it('abre la hoja de impresión con id y rama', () => {
    assert.equal(planoPrintHref('abc', 'muros'), `${PLANO_PRINT_PATH}?id=abc&rama=muros`)
  })
})
