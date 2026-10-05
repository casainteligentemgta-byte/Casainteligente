import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { projectFromPartial } from '@/lib/netvision/storage'
import type { BomSummary } from '@/lib/netvision/types'
import { bomToCsv, bomToExcelXml } from './exporters'
import {
  convertirUsd,
  etiquetaTasa,
  faltaTasa,
  formatoMonto,
  monedaEfectiva,
  normalizarTasa,
} from './moneda'

describe('moneda · dólares y bolívares', () => {
  it('sin tasa, los montos siguen en dólares (nunca «Bs» con un precio en $)', () => {
    assert.equal(monedaEfectiva('VES', undefined), 'USD')
    assert.equal(faltaTasa('VES', undefined), true)
    assert.equal(formatoMonto(1250, 'VES', undefined), '$1,250.00')
    assert.equal(convertirUsd(100, 'VES', null), 100)
    assert.equal(faltaTasa('USD', undefined), false)
  })

  it('con tasa convierte de verdad', () => {
    assert.equal(monedaEfectiva('VES', 365), 'VES')
    assert.equal(faltaTasa('VES', 365), false)
    assert.equal(convertirUsd(100, 'VES', 365), 36500)
    assert.equal(formatoMonto(1250, 'VES', 365), 'Bs 456,250.00')
    assert.equal(formatoMonto(1250, 'EUR', 0.92), '€ 1,150.00')
    assert.equal(formatoMonto(1250, 'USD', 365), '$1,250.00')
    assert.equal(formatoMonto(12.4, 'VES', 365, 0), 'Bs 4,526')
    // 1580.629 $ se muestran como $1,580.63: la conversión parte de ahí.
    assert.equal(formatoMonto(1580.629, 'VES', 365), 'Bs 576,929.95')
    assert.equal(etiquetaTasa('VES'), 'Bs por $')
    assert.equal(etiquetaTasa('EUR'), '€ por $')
  })

  it('valida la tasa', () => {
    assert.equal(normalizarTasa(365.1234567), 365.1235)
    assert.equal(normalizarTasa('365,5'), 365.5)
    assert.equal(normalizarTasa(0), null)
    assert.equal(normalizarTasa(-3), null)
    assert.equal(normalizarTasa('abc'), null)
    assert.equal(normalizarTasa(''), null)
    assert.equal(normalizarTasa(1e9), null)
  })

  it('el proyecto guarda la tasa solo con otra moneda', () => {
    assert.equal(projectFromPartial({ id: 'p', currency: 'VES', tasaCambio: 365 }).tasaCambio, 365)
    assert.equal(projectFromPartial({ id: 'p', currency: 'USD', tasaCambio: 365 }).tasaCambio, undefined)
    assert.equal(projectFromPartial({ id: 'p', currency: 'VES', tasaCambio: -1 }).tasaCambio, undefined)
    assert.equal(projectFromPartial({ id: 'p', currency: 'VES' }).tasaCambio, undefined)
  })
})

describe('moneda · exportar la lista de materiales', () => {
  const bom = {
    lines: [
      { sku: 'cam', category: 'camera', description: 'Cámara', qty: 2, unitUsd: 50, totalUsd: 100 },
    ],
    totalUsd: 100,
  } as unknown as BomSummary

  it('en dólares queda como siempre', () => {
    const csv = bomToCsv(bom, { marginPct: 20, currency: 'USD' })
    assert.match(csv, /^sku,category,description,qty,unit_usd,total_usd$/m)
    assert.match(csv, /^TOTAL_USD,,,, ,120\.00$/m)
    assert.doesNotMatch(csv, /TASA|VES/)
  })

  it('en bolívares con tasa agrega la conversión', () => {
    const csv = bomToCsv(bom, { marginPct: 20, currency: 'VES', tasa: 365 })
    assert.match(csv, /^sku,category,description,qty,unit_usd,total_usd,total_ves$/m)
    assert.match(csv, /^cam,camera,Cámara,2,50,100,36500\.00$/m)
    assert.match(csv, /^TOTAL_USD,,,, ,120\.00,43800\.00$/m)
    assert.match(csv, /^TASA_VES_POR_USD,,,, ,365$/m)
    const xml = bomToExcelXml(bom, { projectName: 'P', marginPct: 20, currency: 'VES', tasa: 365 })
    assert.match(xml, /Total VES/)
    assert.match(xml, /TOTAL VES/)
    assert.match(xml, />43800</)
    assert.match(xml, /Tasa: 365 Bs por \$/)
  })

  it('en bolívares sin tasa no rotula dólares como bolívares', () => {
    const csv = bomToCsv(bom, { marginPct: 20, currency: 'VES' })
    assert.match(csv, /^TOTAL_USD,,,, ,120\.00$/m)
    assert.doesNotMatch(csv, /TOTAL_VES/)
    const xml = bomToExcelXml(bom, { projectName: 'P', marginPct: 20, currency: 'VES' })
    assert.match(xml, /TOTAL USD/)
    assert.doesNotMatch(xml, /TOTAL VES/)
  })
})
