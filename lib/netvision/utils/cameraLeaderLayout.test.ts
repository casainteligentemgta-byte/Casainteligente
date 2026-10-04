import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  boxesOverlap,
  layoutCameraLeaders,
  orthoViaPoint,
  polylineHitsBox,
  polylineIsOrtho,
  polylinesOverlap,
  type LeaderBox,
} from './cameraLeaderLayout'

function box(
  id: string,
  pinX: number,
  pinY: number,
  x: number,
  y: number,
  w = 110,
  h = 38,
): LeaderBox {
  return { id, pinX, pinY, x, y, w, h }
}

function segs(points: number[]) {
  const out: Array<{ x0: number; y0: number; x1: number; y1: number }> = []
  for (let i = 0; i + 3 < points.length; i += 2) {
    out.push({
      x0: points[i]!,
      y0: points[i + 1]!,
      x1: points[i + 2]!,
      y1: points[i + 3]!,
    })
  }
  return out
}

function collinearOverlap(
  a: { x0: number; y0: number; x1: number; y1: number },
  b: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  const horiz = Math.abs(a.y0 - a.y1) < 0.5 && Math.abs(b.y0 - b.y1) < 0.5 && Math.abs(a.y0 - b.y0) < 1
  const vert = Math.abs(a.x0 - a.x1) < 0.5 && Math.abs(b.x0 - b.x1) < 0.5 && Math.abs(a.x0 - b.x0) < 1
  if (horiz) {
    const a0 = Math.min(a.x0, a.x1)
    const a1 = Math.max(a.x0, a.x1)
    const b0 = Math.min(b.x0, b.x1)
    const b1 = Math.max(b.x0, b.x1)
    return Math.min(a1, b1) - Math.max(a0, b0) > 2
  }
  if (vert) {
    const a0 = Math.min(a.y0, a.y1)
    const a1 = Math.max(a.y0, a.y1)
    const b0 = Math.min(b.y0, b.y1)
    const b1 = Math.max(b.y0, b.y1)
    return Math.min(a1, b1) - Math.max(a0, b0) > 2
  }
  return false
}

describe('cameraLeaderLayout', () => {
  it('separa chips que nacen uno encima del otro', () => {
    const laid = layoutCameraLeaders([
      box('a', 100, 100, 160, 50),
      box('b', 108, 104, 160, 50),
    ])
    assert.equal(boxesOverlap(laid[0]!, laid[1]!, 8), false)
  })

  it('si no hay solape usa una recta del pin al borde del chip', () => {
    const laid = layoutCameraLeaders([box('a', 80, 120, 180, 40)])
    const p = laid[0]!.points
    assert.equal(laid[0]!.mode, 'straight')
    assert.equal(p[0], 80)
    assert.equal(p[1], 120)
    const endX = p[p.length - 2]!
    const endY = p[p.length - 1]!
    assert.ok(Math.abs(endX - 180) < 1 || Math.abs(endX - 290) < 1)
    assert.ok(Math.abs(endY - (40 + 19)) < 2)
    assert.equal(p.length, 4)
  })

  it('la línea no atraviesa el otro botón', () => {
    const a = box('a', 40, 80, 200, 40)
    const b = box('b', 40, 200, 200, 160)
    const laid = layoutCameraLeaders([a, b])
    const ra = laid.find((l) => l.id === 'a')!
    const rb = laid.find((l) => l.id === 'b')!
    assert.equal(polylineHitsBox(ra.points, rb, 2), false)
    assert.equal(polylineHitsBox(rb.points, ra, 2), false)
  })

  it('dos rutas no comparten el mismo tramo', () => {
    const laid = layoutCameraLeaders([
      box('a', 90, 90, 200, 30),
      box('b', 92, 92, 200, 30),
      box('c', 94, 94, 200, 30),
    ])
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        assert.equal(
          polylinesOverlap(laid[i]!.points, laid[j]!.points),
          false,
          `${laid[i]!.id} vs ${laid[j]!.id}`,
        )
        for (const sa of segs(laid[i]!.points)) {
          for (const sb of segs(laid[j]!.points)) {
            assert.equal(
              collinearOverlap(sa, sb),
              false,
              `${laid[i]!.id} vs ${laid[j]!.id} ${JSON.stringify(sa)} ${JSON.stringify(sb)}`,
            )
          }
        }
      }
    }
  })

  it('cuatro cámaras juntas mantienen chips y carriles libres', () => {
    const laid = layoutCameraLeaders([
      box('a', 120, 140, 184, 84),
      box('b', 126, 146, 184, 84),
      box('c', 132, 150, 184, 84),
      box('d', 118, 154, 184, 84),
    ])
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        assert.equal(boxesOverlap(laid[i]!, laid[j]!, 8), false)
        assert.equal(polylinesOverlap(laid[i]!.points, laid[j]!.points), false)
        assert.equal(polylineHitsBox(laid[i]!.points, laid[j]!, 2), false)
        assert.equal(polylineHitsBox(laid[j]!.points, laid[i]!, 2), false)
      }
      const p = laid[i]!.points
      assert.ok(p.length >= 4)
      assert.equal(p[0], [120, 126, 132, 118][i])
    }
  })

  it('al bajar el nodo elige la escuadra vertical', () => {
    const pts = orthoViaPoint({ x: 80, y: 120 }, { x: 140, y: 220 }, { x: 180, y: 59 })
    assert.equal(polylineIsOrtho(pts), true)
    assert.ok(pts.some((v, i) => i % 2 === 1 && Math.abs(v - 220) < 1))
  })

  it('un nodo del operador se interpreta como quiebre a 90°', () => {
    const laid = layoutCameraLeaders([box('a', 80, 120, 180, 40)], {
      customElbows: { a: [{ x: 120, y: 80 }] },
    })
    assert.equal(laid[0]!.mode, 'custom')
    assert.equal(polylineIsOrtho(laid[0]!.points), true)
    assert.ok(laid[0]!.points.includes(120))
  })

  it('varios nodos del operador se respetan en orden', () => {
    const laid = layoutCameraLeaders([box('a', 80, 120, 180, 40)], {
      customElbows: {
        a: [
          { x: 80, y: 80 },
          { x: 180, y: 80 },
        ],
      },
    })
    assert.equal(laid[0]!.mode, 'custom')
    assert.equal(laid[0]!.points[2], 80)
    assert.equal(laid[0]!.points[3], 80)
    assert.equal(laid[0]!.points[4], 180)
    assert.equal(laid[0]!.points[5], 80)
  })

  it('si la recta cruza otro botón usa quiebres a 90°', () => {
    const laid = layoutCameraLeaders([
      box('a', 40, 100, 300, 82),
      box('b', 40, 220, 160, 80),
    ])
    const ra = laid.find((l) => l.id === 'a')!
    assert.equal(ra.mode, 'ortho')
    assert.equal(polylineIsOrtho(ra.points), true)
    assert.ok(ra.points.length >= 6)
    assert.equal(polylineHitsBox(ra.points, laid.find((l) => l.id === 'b')!, 2), false)
  })

  it('si el otro botón está en la horizontal elige un desvío vertical', () => {
    const laid = layoutCameraLeaders([
      box('a', 40, 100, 320, 81),
      box('b', 40, 200, 160, 81),
    ])
    const ra = laid.find((l) => l.id === 'a')!
    const rb = laid.find((l) => l.id === 'b')!
    assert.equal(polylineIsOrtho(ra.points), true)
    assert.equal(polylineHitsBox(ra.points, rb, 2), false)
    assert.ok(ra.points.some((_, i) => i % 2 === 1 && Math.abs(ra.points[i]! - 100) > 12))
  })
})
