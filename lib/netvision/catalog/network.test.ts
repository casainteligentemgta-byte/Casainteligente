import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_AP_ID, DEFAULT_SWITCH_ID, getNetworkModel, networkCatalogByKind } from './network'

describe('catálogo de red · UniFi (ficha oficial ui.com)', () => {
  it('el Switch Lite 8 PoE tiene 8 puertos y solo 4 con PoE (52 W)', () => {
    const m = getNetworkModel('sw-poe-8')
    assert.ok(m)
    assert.equal(m.ports, 8)
    assert.equal(m.poePorts, 4)
    assert.equal(m.poeBudgetW, 52)
    assert.equal(m.drawWatts, 8)
  })

  it('distingue los tres switches de 24 puertos por su presupuesto PoE', () => {
    const gen1 = getNetworkModel('sw-poe-24')
    const std = getNetworkModel('sw-usw-24-poe')
    const pro = getNetworkModel('sw-usw-pro-24-poe')
    assert.deepEqual([gen1?.poePorts, gen1?.poeBudgetW], [24, 250])
    assert.deepEqual([std?.poePorts, std?.poeBudgetW], [16, 95])
    assert.deepEqual([pro?.poePorts, pro?.poeBudgetW], [24, 400])
    for (const m of [gen1, std, pro]) {
      assert.equal(m?.ports, 24)
      assert.equal(m?.rackUnits, 1)
    }
  })

  it('los equipos por defecto no cambian', () => {
    assert.equal(DEFAULT_SWITCH_ID, 'sw-poe-8')
    assert.equal(DEFAULT_AP_ID, 'ap-u6-lite')
    assert.equal(networkCatalogByKind('ap').length, 2)
  })
})
