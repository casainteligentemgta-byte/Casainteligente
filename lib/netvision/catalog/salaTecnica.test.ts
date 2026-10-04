import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canPlaceInRack,
  clampHddTb,
  clampRackSizeU,
  firstFreeU,
  hddPriceUsd,
  mountIntoRack,
  resizeRack,
  unmountFromRacks,
  usedU,
} from './salaTecnica'
import type { DesignInfraDevice } from '@/lib/netvision/types'
import type { MountableItem as Item } from './salaTecnica'

function rack(u = 12): DesignInfraDevice {
  return {
    id: 'r1',
    label: 'RACK-01',
    kind: 'rack',
    modelId: 'rack-12u',
    x: 0.2,
    y: 0.2,
    rackUnits: u,
    mounts: [],
  }
}

function item(id: string, h: number): Item {
  return {
    id,
    label: id,
    source: 'infra',
    heightU: h,
    detail: `${h}U`,
  }
}

describe('salaTecnica rack', () => {
  it('acepta tamaños de rack y TB de disco', () => {
    assert.equal(clampRackSizeU(12), 12)
    assert.equal(clampRackSizeU(99), 12)
    assert.equal(clampHddTb(8), 8)
    assert.equal(clampHddTb(7), 6)
  })

  it('monta 2U y 1U sin solape y busca el hueco', () => {
    const items: Item[] = [item('ups', 2), item('hdd', 1)]
    let r = rack(6)
    assert.equal(firstFreeU(r, items, 2), 1)
    r = mountIntoRack(r, 'ups', 'infra', 1)
    assert.equal(canPlaceInRack(r, items, 1, 1), false)
    assert.equal(firstFreeU(r, items, 1), 3)
    r = mountIntoRack(r, 'hdd', 'infra', 3)
    assert.equal(usedU(r, items), 3)
    const next = unmountFromRacks([r], 'ups')
    assert.equal(next[0]!.mounts?.length, 1)
  })

  it('no deja pasar del tamaño del rack', () => {
    const items = [item('big', 2)]
    const r = rack(4)
    assert.equal(canPlaceInRack(r, items, 4, 2), false)
    assert.equal(canPlaceInRack(r, items, 3, 2), true)
  })

  it('al achicar el rack suelta lo que ya no cabe', () => {
    const items = [item('ups', 2)]
    let r = mountIntoRack(rack(6), 'ups', 'infra', 5)
    r = resizeRack(r, 4, items)
    assert.equal(r.rackUnits, 4)
    assert.equal(r.mounts?.length, 0)
  })

  it('precio del disco escala con los TB', () => {
    const model = {
      id: 'hdd-skyhawk',
      kind: 'hdd' as const,
      brand: 'Seagate',
      name: 'SkyHawk',
      capacityTb: 4,
      rackUnits: 1,
      priceUsd: 220,
    }
    assert.equal(hddPriceUsd(model, 8), 440)
  })
})
