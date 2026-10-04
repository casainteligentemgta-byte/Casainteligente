import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CAM_LABEL_DX_PX,
  cameraLabelStagePos,
  clampLabelOffset,
  labelOffsetFromNorm,
  rotateCameraLabelOffset,
} from './cameraLabelOffset'

describe('cameraLabelOffset', () => {
  it('sin offset usa +12 / -18 px', () => {
    const p = cameraLabelStagePos(
      { id: 'c', label: 'CAM', x: 0.5, y: 0.5, modelId: 'x', yawDeg: 0, mountHeightM: 2.8 },
      10,
      20,
      200,
      100,
    )
    assert.equal(p.x, 10 + 100 + DEFAULT_CAM_LABEL_DX_PX)
    assert.equal(p.y, 20 + 50 - 18)
  })

  it('guarda el offset en coords normalizadas', () => {
    const off = labelOffsetFromNorm({ x: 0.4, y: 0.3 }, 0.55, 0.22)
    assert.ok(Math.abs(off.labelOffsetX - 0.15) < 1e-9)
    assert.ok(Math.abs(off.labelOffsetY + 0.08) < 1e-9)
  })

  it('rota el offset 90° y vuelve', () => {
    const rotated = rotateCameraLabelOffset({ labelOffsetX: 0.1, labelOffsetY: -0.2 }, 'cw')
    assert.deepEqual(rotated, { labelOffsetX: 0.2, labelOffsetY: 0.1 })
    const back = rotateCameraLabelOffset(rotated, 'ccw')
    assert.deepEqual(back, { labelOffsetX: 0.1, labelOffsetY: -0.2 })
  })

  it('rechaza offsets absurdos', () => {
    assert.equal(clampLabelOffset(9), 0.85)
    assert.equal(clampLabelOffset(undefined), undefined)
  })
})
