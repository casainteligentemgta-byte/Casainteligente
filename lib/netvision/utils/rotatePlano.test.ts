import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rotateNormPoint, rotateProjectGeometry, invertRgbPixels } from './rotatePlano'
import { emptyProject } from '@/lib/netvision/storage'

describe('rotateNormPoint', () => {
  it('90° horario: esquina superior izquierda va a superior derecha', () => {
    assert.deepEqual(rotateNormPoint(0, 0, 'cw'), { x: 1, y: 0 })
  })

  it('90° antihorario: esquina superior izquierda va a inferior izquierda', () => {
    assert.deepEqual(rotateNormPoint(0, 0, 'ccw'), { x: 0, y: 1 })
  })

  it('cw y ccw se cancelan', () => {
    const p = { x: 0.2, y: 0.7 }
    const back = rotateNormPoint(
      rotateNormPoint(p.x, p.y, 'cw').x,
      rotateNormPoint(p.x, p.y, 'cw').y,
      'ccw',
    )
    assert.ok(Math.abs(back.x - p.x) < 1e-9)
    assert.ok(Math.abs(back.y - p.y) < 1e-9)
  })
})

describe('rotateProjectGeometry', () => {
  it('rota cámara, yaw y escala', () => {
    const base = emptyProject({ id: 't', name: 't' })
    const project = {
      ...base,
      cameras: [
        {
          id: 'c1',
          label: 'CAM-01',
          x: 0.25,
          y: 0.1,
          modelId: 'x',
          yawDeg: 0,
          mountHeightM: 2.8,
        },
      ],
      scale: { metersPerNormX: 10, metersPerNormY: 40, calibrated: true },
    }
    const next = rotateProjectGeometry(project, 'cw')
    assert.equal(next.cameras[0]!.x, 0.9)
    assert.equal(next.cameras[0]!.y, 0.25)
    assert.equal(next.cameras[0]!.yawDeg, 90)
    assert.equal(next.scale.metersPerNormX, 40)
    assert.equal(next.scale.metersPerNormY, 10)
  })
})

describe('invertRgbPixels', () => {
  it('pasa negro a blanco y blanco a negro', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])
    invertRgbPixels(data)
    assert.deepEqual([...data], [255, 255, 255, 255, 0, 0, 0, 255])
  })

  it('conserva alfa y invierte gris', () => {
    const data = new Uint8ClampedArray([128, 64, 32, 200])
    invertRgbPixels(data)
    assert.deepEqual([...data], [127, 191, 223, 200])
  })
})
