import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defaultPlanDeviceId, getPlanDeviceModel } from '@/lib/netvision/catalog/planDevices'
import {
  buildApCoverageSectors,
  buildPlanDeviceSectors,
} from './planDeviceCoverage'
import type { DesignPlanDevice } from '@/lib/netvision/types'

describe('buildPlanDeviceSectors', () => {
  it('arma semáforo omnidireccional para un altavoz', () => {
    const device: DesignPlanDevice = {
      id: 's1',
      label: 'ALT-01',
      x: 0.4,
      y: 0.5,
      discipline: 'sonido',
      kind: 'speaker',
      modelId: defaultPlanDeviceId('sonido'),
    }
    const sectors = buildPlanDeviceSectors(
      [device],
      { metersPerNormX: 40, metersPerNormY: 20, calibrated: true },
      [],
      'sonido',
    )
    assert.equal(sectors.length, 1)
    assert.ok((sectors[0]!.polygon?.length ?? 0) >= 3)
    assert.ok((sectors[0]!.greenPolygon?.length ?? 0) >= 3)
    assert.ok(Math.abs(sectors[0]!.endAngleRad - sectors[0]!.startAngleRad - Math.PI * 2) < 1e-6)
  })

  it('filtra por disciplina', () => {
    const sectors = buildPlanDeviceSectors(
      [
        {
          id: 'd1',
          label: 'HUB-01',
          x: 0.2,
          y: 0.2,
          discipline: 'domotica',
          kind: 'hub',
          modelId: defaultPlanDeviceId('domotica'),
        },
      ],
      { metersPerNormX: 30, metersPerNormY: 30, calibrated: true },
      [],
      'electrico',
    )
    assert.equal(sectors.length, 0)
  })
})

describe('buildApCoverageSectors', () => {
  it('solo incluye APs y rellena bandas', () => {
    const sectors = buildApCoverageSectors(
      [
        { id: 'ap1', x: 0.5, y: 0.5, kind: 'ap', modelId: 'ap-u6-lite' },
        { id: 'sw1', x: 0.2, y: 0.2, kind: 'switch', modelId: 'sw' },
      ],
      () => 12,
      { metersPerNormX: 40, metersPerNormY: 40, calibrated: true },
      [],
    )
    assert.equal(sectors.length, 1)
    assert.ok((sectors[0]!.greenPolygon?.length ?? 0) >= 3)
  })
})

describe('catálogo de dispositivos · Ezviz T9C', () => {
  it('está en sonido como sirena y requiere el gateway A3', () => {
    const t9c = getPlanDeviceModel('snd-ezviz-t9c')
    assert.ok(t9c)
    assert.equal(t9c.brand, 'Ezviz')
    assert.equal(t9c.discipline, 'sonido')
    assert.equal(t9c.kind, 'siren')
    assert.equal(t9c.fovDeg, 360)
    assert.equal(t9c.rangeM, 12)
    assert.equal(t9c.priceUsd, 54)
    assert.match(t9c.name, /A3/)
  })
})
