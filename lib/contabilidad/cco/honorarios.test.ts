import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPatchCcoCompraTelegram } from './defaultsCompraTelegram'
import {
  aplicarHonorariosABase,
  honorariosAdminPctODefault,
  resolverAdminPct,
} from './honorarios'
import { calcularKpisOficiales, honorariosDeFila } from './kpisOficiales'

describe('honorariosAdminPctODefault: 0 es válido; 15 solo si falta el valor', () => {
  it('0 → 0 (no lo convierte en 15)', () => {
    assert.equal(honorariosAdminPctODefault(0), 0)
    assert.equal(honorariosAdminPctODefault('0'), 0)
  })

  it('null/undefined/vacío → 15', () => {
    assert.equal(honorariosAdminPctODefault(null), 15)
    assert.equal(honorariosAdminPctODefault(undefined), 15)
    assert.equal(honorariosAdminPctODefault(''), 15)
    assert.equal(honorariosAdminPctODefault(Number.NaN), 15)
  })

  it('un porcentaje informado distinto de 0 se respeta', () => {
    assert.equal(honorariosAdminPctODefault(15), 15)
    assert.equal(honorariosAdminPctODefault(10), 10)
  })
})

describe('resolverAdminPct', () => {
  it('null/undefined en la fila usa el % global; si el global falta, 15', () => {
    assert.equal(resolverAdminPct(null, 15), 15)
    assert.equal(resolverAdminPct(undefined, 15), 15)
    assert.equal(resolverAdminPct(null, null), 15)
    assert.equal(resolverAdminPct(undefined, undefined), 15)
  })

  it('0 en config global → 0 (obra tipo TH-4)', () => {
    assert.equal(resolverAdminPct(null, 0), 0)
    assert.equal(resolverAdminPct(undefined, 0), 0)
  })

  it('admin_pct_override = 0 es válido y no cae al 15 global', () => {
    assert.equal(resolverAdminPct(0, 15), 0)
    assert.equal(resolverAdminPct(0, 10), 0)
  })

  it('un override positivo gana sobre el global', () => {
    assert.equal(resolverAdminPct(10, 15), 10)
    assert.equal(resolverAdminPct(15, 0), 15)
  })
})

describe('aplicarHonorariosABase con 0%', () => {
  it('global 0 → 0 honorarios en compras nuevas', () => {
    const r = aplicarHonorariosABase(200, null, 0)
    assert.equal(r.adminPct, 0)
    assert.equal(r.honorariosUsd, 0)
    assert.equal(r.costoTotalUsd, 200)
  })

  it('override 0 → 0 honorarios aunque el global sea 15', () => {
    const r = aplicarHonorariosABase(200, 0, 15)
    assert.equal(r.adminPct, 0)
    assert.equal(r.honorariosUsd, 0)
    assert.equal(r.costoTotalUsd, 200)
  })

  it('sin config (null) → 15%', () => {
    const r = aplicarHonorariosABase(200, null, honorariosAdminPctODefault(null))
    assert.equal(r.adminPct, 15)
    assert.equal(r.honorariosUsd, 30)
    assert.equal(r.costoTotalUsd, 230)
  })
})

describe('KPIs oficiales: honorariosPctGlobal 0 no se convierte en 15', () => {
  it('0 → 0 honorarios calculados', () => {
    const k = calcularKpisOficiales({
      ingresosUsd: [1000],
      honorariosPctGlobal: 0,
      gastos: [{ monto_usd: 200, honorarios_usd: null, cco_estado: 'PAGADO' }],
    })
    assert.equal(k.gastosNetos, 200)
    assert.equal(k.adminDelegada, 0)
    assert.equal(k.costoTotal, 200)
  })

  it('override 0 → 0 aunque el global sea 15', () => {
    assert.equal(honorariosDeFila(200, { honorarios_usd: null, admin_pct_override: 0 }, 15), 0)
    const k = calcularKpisOficiales({
      ingresosUsd: [1000],
      honorariosPctGlobal: 15,
      gastos: [
        {
          monto_usd: 200,
          honorarios_usd: null,
          admin_pct_override: 0,
          cco_estado: 'PAGADO',
        },
      ],
    })
    assert.equal(k.adminDelegada, 0)
  })

  it('null global → 15%', () => {
    const k = calcularKpisOficiales({
      ingresosUsd: [1000],
      honorariosPctGlobal: null,
      gastos: [{ monto_usd: 200, honorarios_usd: null, cco_estado: 'PAGADO' }],
    })
    assert.equal(k.adminDelegada, 30)
  })
})

describe('defaults Telegram: compras nuevas respetan 0%', () => {
  it('honorariosAdminPct 0 no escribe 15% de honorarios', () => {
    const patch = buildPatchCcoCompraTelegram({
      supplierName: 'Ferretería X',
      condicionPago: 'contado',
      montoUsd: 200,
      honorariosAdminPct: 0,
    })
    assert.ok(patch)
    assert.equal(patch.honorarios_usd, undefined)
  })

  it('sin % (null/undefined) usa 15 y calcula honorarios', () => {
    const sinValor = buildPatchCcoCompraTelegram({
      supplierName: 'Ferretería X',
      condicionPago: 'contado',
      montoUsd: 200,
      honorariosAdminPct: null,
    })
    assert.equal(sinValor?.honorarios_usd, 30)

    const omitido = buildPatchCcoCompraTelegram({
      supplierName: 'Ferretería X',
      condicionPago: 'contado',
      montoUsd: 200,
    })
    assert.equal(omitido?.honorarios_usd, 30)
  })
})
