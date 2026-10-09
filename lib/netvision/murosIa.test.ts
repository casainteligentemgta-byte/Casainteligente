import { describe, it } from 'bun:test'
import assert from 'node:assert/strict'
import { enderezar, resultadoDesdeIa, resumenMurosIa, unirColineales } from '@/lib/netvision/murosIa'

describe('muros detectados por IA', () => {
  it('pasa de 0–1000 a 0–1 y separa muros, puertas y ventanas', () => {
    const r = resultadoDesdeIa({
      muros: [
        { x1: 100, y1: 100, x2: 900, y2: 100, tipo: 'muro' },
        { x1: 400, y1: 100, x2: 480, y2: 100, tipo: 'puerta' },
        { x1: 900, y1: 200, x2: 900, y2: 400, tipo: 'ventana' },
      ],
    })
    assert.deepEqual(r.walls, [{ x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.1 }])
    assert.equal(r.doors.length, 1)
    assert.equal(r.windows.length, 1)
  })

  it('endereza los casi horizontales y verticales', () => {
    assert.deepEqual(enderezar({ x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.51 }), { x1: 0.1, y1: 0.505, x2: 0.9, y2: 0.505 })
    const diag = { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5 }
    assert.deepEqual(enderezar(diag), diag)
  })

  it('une tramos colineales que se solapan o casi se tocan', () => {
    const u = unirColineales([
      { x1: 0.1, y1: 0.3, x2: 0.4, y2: 0.3 },
      { x1: 0.405, y1: 0.302, x2: 0.7, y2: 0.302 },
      { x1: 0.1, y1: 0.6, x2: 0.4, y2: 0.6 },
    ])
    assert.equal(u.length, 2)
    const largo = u.find((s) => s.x2 === 0.7)!
    assert.equal(largo.x1, 0.1)
  })

  it('descarta basura, diminutos y coordenadas fuera de rango', () => {
    const r = resultadoDesdeIa({
      muros: [
        { x1: 'a', y1: 0, x2: 10, y2: 10 },
        { x1: 500, y1: 500, x2: 503, y2: 500, tipo: 'muro' },
        { x1: -50, y1: 200, x2: 1500, y2: 200, tipo: 'muro' },
      ],
    })
    assert.deepEqual(r.walls, [{ x1: 0, y1: 0.2, x2: 1, y2: 0.2 }])
    assert.equal(resultadoDesdeIa(null).walls.length, 0)
  })

  it('resume el resultado', () => {
    assert.match(resumenMurosIa(resultadoDesdeIa({ muros: [] })), /no encontró/)
  })
})
