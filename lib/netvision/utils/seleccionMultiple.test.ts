import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProject } from '@/lib/netvision/storage'
import type { DesignCamera, NetVisionProject } from '@/lib/netvision/types'
import {
  alternarSeleccion,
  depurarSeleccion,
  desplazamientoGrupo,
  duplicarCamaras,
  moverGrupo,
  resumenSeleccion,
  siguienteEtiquetaCamara,
} from './seleccionMultiple'

const cam = (id: string, x: number, y: number, extra: Partial<DesignCamera> = {}): DesignCamera => ({
  id,
  label: id.toUpperCase(),
  x,
  y,
  modelId: 'ezviz-h9c',
  yawDeg: 90,
  mountHeightM: 3,
  ...extra,
})

function proyecto(): NetVisionProject {
  const base = emptyProject({ id: 'p', name: 'prueba' })
  return {
    ...base,
    cameras: [cam('a', 0.2, 0.2), cam('b', 0.5, 0.5), cam('c', 0.9, 0.9)],
    networkNodes: [
      { ...({} as NetVisionProject['networkNodes'][number]), id: 'sw', label: 'SW', x: 0.4, y: 0.1, kind: 'switch', modelId: 'sw-poe-8', linkedCameraIds: [] },
    ],
  }
}

describe('selección múltiple', () => {
  it('alterna: agrega y quita', () => {
    assert.deepEqual(alternarSeleccion([], 'a'), ['a'])
    assert.deepEqual(alternarSeleccion(['a', 'b'], 'a'), ['b'])
  })

  it('depura ids que ya no existen', () => {
    assert.deepEqual(depurarSeleccion(proyecto(), ['a', 'borrada', 'sw']), ['a', 'sw'])
  })

  it('mueve el grupo lo mismo que el equipo arrastrado', () => {
    const p = moverGrupo(proyecto(), ['a', 'b', 'sw'], 'a', { x: 0.3, y: 0.25 })
    const pos = (id: string) => {
      const e = [...p.cameras, ...p.networkNodes].find((x) => x.id === id)!
      return [e.x, e.y]
    }
    assert.deepEqual(pos('a'), [0.3, 0.25])
    assert.deepEqual(pos('b'), [0.6, 0.55])
    assert.deepEqual(pos('sw'), [0.5, 0.15])
    // El que no está elegido no se mueve.
    assert.deepEqual(pos('c'), [0.9, 0.9])
  })

  it('no deja que el grupo salga del plano y conserva la separación', () => {
    const equipos = [
      { id: 'a', x: 0.2, y: 0.2 },
      { id: 'c', x: 0.9, y: 0.9 },
    ]
    const d = desplazamientoGrupo(equipos, ['a', 'c'], 'a', { x: 0.6, y: 0.05 })
    assert.ok(Math.abs(d.dx - 0.1) < 1e-9)
    assert.ok(Math.abs(d.dy - -0.15) < 1e-9)
    const p = moverGrupo(proyecto(), ['a', 'c'], 'a', { x: 0.6, y: 0.05 })
    const a = p.cameras.find((x) => x.id === 'a')!
    const c = p.cameras.find((x) => x.id === 'c')!
    assert.deepEqual([c.x, c.y], [1, 0.75])
    assert.ok(Math.abs(c.x - a.x - 0.7) < 1e-9)
    assert.ok(Math.abs(c.y - a.y - 0.7) < 1e-9)
  })

  it('arrastrar un equipo que no está en la selección no mueve nada', () => {
    const original = proyecto()
    assert.equal(moverGrupo(original, ['a', 'b'], 'c', { x: 0.1, y: 0.1 }), original)
  })

  it('el siguiente nombre no repite uno existente tras borrar', () => {
    assert.equal(siguienteEtiquetaCamara([]), 'CAM-01')
    assert.equal(siguienteEtiquetaCamara(['CAM-01', 'CAM-02']), 'CAM-03')
    // Se borró la CAM-02: quedan 2 cámaras pero el siguiente es CAM-04.
    assert.equal(siguienteEtiquetaCamara(['CAM-01', 'CAM-03']), 'CAM-04')
    assert.equal(siguienteEtiquetaCamara(['Entrada', 'Patio']), 'CAM-03')
    assert.equal(siguienteEtiquetaCamara(['CAM-09']), 'CAM-10')
  })

  it('duplica con el mismo modelo y ajustes, nombre nuevo y desplazada', () => {
    const camaras = [
      cam('a', 0.2, 0.2, {
        label: 'CAM-01',
        yawDeg: 135,
        fovDeg: 80,
        rangeM: 12,
        markerColor: 'verde',
        leaderElbows: [{ x: 0.1, y: 0.1 }],
        lensVision: { tele: { yawDeg: 10 } } as DesignCamera['lensVision'],
      }),
      cam('b', 0.99, 0.99, { label: 'CAM-02' }),
    ]
    let n = 0
    const copias = duplicarCamaras(camaras, ['a', 'b'], () => `nuevo-${++n}`)
    assert.equal(copias.length, 2)
    const [c1, c2] = copias as [DesignCamera, DesignCamera]
    assert.equal(c1.id, 'nuevo-1')
    assert.equal(c1.label, 'CAM-03')
    assert.equal(c2.label, 'CAM-04')
    assert.equal(c1.modelId, 'ezviz-h9c')
    assert.equal(c1.yawDeg, 135)
    assert.equal(c1.fovDeg, 80)
    assert.equal(c1.rangeM, 12)
    assert.equal(c1.markerColor, 'verde')
    assert.deepEqual(c1.lensVision, camaras[0]!.lensVision)
    assert.notEqual(c1.lensVision, camaras[0]!.lensVision)
    assert.equal(c1.leaderElbows, undefined)
    assert.deepEqual([c1.x, c1.y], [0.235, 0.235])
    // En el borde, la copia se va hacia adentro.
    assert.deepEqual([c2.x, c2.y], [0.955, 0.955])
    // El original no cambia.
    assert.equal(camaras[0]!.label, 'CAM-01')
    assert.equal(camaras[0]!.leaderElbows?.length, 1)
  })

  it('resume lo elegido', () => {
    const p = proyecto()
    assert.equal(resumenSeleccion(p, ['a', 'b', 'sw']), '2 cámaras · 1 equipo de red')
    assert.equal(resumenSeleccion(p, ['a']), '1 cámara')
    assert.equal(resumenSeleccion(p, []), 'Nada seleccionado')
  })
})
