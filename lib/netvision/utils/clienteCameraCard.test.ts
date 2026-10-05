import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CableRoute, CameraModel } from '@/lib/netvision/types'
import { CAMERA_CATALOG } from '@/lib/netvision/catalog/cameras'
import {
  buildClienteCameraCard,
  cameraCableMeters,
  inferCameraConnection,
  totalClienteCableMeters,
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
    assert.equal(wired.formFactor, 'dome')
    // Sin foto en catálogo → null (la ficha dibuja la silueta por forma).
    assert.equal(wired.imageUrl, null)
    const wireless = buildClienteCameraCard(
      { id: 'c1', label: 'CAM-01', x: 0.2, y: 0.3, modelId: 'ezviz-bc1c', yawDeg: 0, mountHeightM: 2.8 },
      [route],
    )
    assert.equal(wireless.wired, false)
    assert.equal(wireless.cableMeters, 0)
    assert.equal(totalClienteCableMeters([wired, wireless]), wired.cableMeters)
  })

  it('la H9c lleva la foto y los ángulos de la ficha oficial, y sigue cableada', () => {
    const card = buildClienteCameraCard(
      { id: 'c2', label: 'CAM-02', x: 0.2, y: 0.3, modelId: 'ezviz-h9c', yawDeg: 0, mountHeightM: 2.8 },
      [],
    )
    assert.match(card.imageUrl ?? '', /^https:\/\//)
    assert.equal(card.fovLabel, 'Dual 108°+55°')
    assert.equal(card.formFactor, 'ptz')
    assert.equal(card.wired, true)
    assert.equal(card.poeWatts, 12)
  })

  it('todas las Ezviz llevan foto oficial y conservan su tipo de conexión', () => {
    const esperado: Record<string, 'poe' | 'battery' | 'wifi'> = {
      'ezviz-c6n': 'poe',
      'ezviz-c6cn': 'poe',
      'ezviz-c8c': 'poe',
      'ezviz-h3': 'poe',
      'ezviz-h4': 'wifi',
      'ezviz-h4-poe': 'poe',
      'ezviz-h8c': 'poe',
      'ezviz-h9c': 'poe',
      'ezviz-ty2': 'poe',
      'ezviz-c3w-pro': 'poe',
      'ezviz-bc1c': 'battery',
      'ezviz-eb8': 'battery',
    }
    const ezviz = CAMERA_CATALOG.filter((m) => m.brand === 'Ezviz')
    assert.deepEqual(ezviz.map((m) => m.id).sort(), Object.keys(esperado).sort())
    for (const m of ezviz) {
      assert.match(m.imageUrl ?? '', /^https:\/\/mfs\.ezvizlife\.com\/[0-9a-f]{32}\.png$/, m.id)
      assert.equal(inferCameraConnection(m), esperado[m.id], m.id)
      assert.ok((m.notes ?? '').length > 0, m.id)
    }
  })

  it('la H4 existe en versión Wi-Fi y en versión PoE', () => {
    const cam = { id: 'c9', label: 'CAM-09', x: 0.2, y: 0.3, yawDeg: 0, mountHeightM: 2.8 }
    const wifiCard = buildClienteCameraCard({ ...cam, modelId: 'ezviz-h4' }, [route])
    assert.equal(wifiCard.formLabel, 'Domo')
    assert.equal(wifiCard.fovLabel, '106°')
    assert.equal(wifiCard.wired, false)
    assert.equal(wifiCard.cableMeters, 0)
    const poeCard = buildClienteCameraCard({ ...cam, modelId: 'ezviz-h4-poe' }, [])
    assert.equal(poeCard.wired, true)
    assert.equal(poeCard.connectionLabel, 'Cableada (PoE)')
    assert.equal(poeCard.poeWatts, 8)
  })
})
