import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CableRoute, CameraModel } from '@/lib/netvision/types'
import {
  buildClienteCameraCard,
  cameraCableMeters,
  inferCameraConnection,
} from './clienteCameraCard'

const poe: CameraModel = {
  id: 'hik-ds',
  brand: 'Hikvision',
  name: 'DS-2CD',
  formFactor: 'dome',
  fovDeg: 90,
  rangeDayM: 20,
  rangeNightM: 15,
  resolution: '4MP',
  bitrateMbps: 8,
  poeWatts: 7,
  priceUsd: 99,
}

const wifi: CameraModel = {
  ...poe,
  id: 'ezviz-bc1c',
  brand: 'Ezviz',
  name: 'BC1C batería',
  notes: 'Cámara a batería Wi-Fi',
  poeWatts: 0,
}

const route: CableRoute = {
  id: 'cable-c1-sw',
  fromId: 'c1',
  toId: 'sw',
  fromLabel: 'CAM-01',
  toLabel: 'SW-01',
  points: [],
  straightM: 8,
  routeM: 12.4,
  type: 'CAT6',
  certified: true,
  warn: false,
  warning: null,
}

describe('clienteCameraCard', () => {
  it('detecta PoE vs batería/Wi-Fi', () => {
    assert.equal(inferCameraConnection(poe), 'poe')
    assert.equal(inferCameraConnection(wifi), 'battery')
  })

  it('suma metros de cable de esa cámara', () => {
    assert.equal(cameraCableMeters([route], 'c1'), 12.4)
    assert.equal(cameraCableMeters([route], 'otra'), 0)
  })

  it('ficha cableada incluye metros; inalámbrica no', () => {
    const wired = buildClienteCameraCard(
      { id: 'c1', label: 'CAM-01', x: 0.2, y: 0.3, modelId: 'hik-ds2cd2143', yawDeg: 0, mountHeightM: 2.8 },
      [route],
    )
    assert.equal(wired.wired, true)
    assert.ok(wired.qualities.includes('m'))
    const wireless = buildClienteCameraCard(
      { id: 'c1', label: 'CAM-01', x: 0.2, y: 0.3, modelId: 'ezviz-bc1c', yawDeg: 0, mountHeightM: 2.8 },
      [route],
    )
    assert.equal(wireless.wired, false)
    assert.equal(wireless.cableMeters, 0)
  })
})
