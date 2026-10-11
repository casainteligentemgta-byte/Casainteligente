import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { esVenta, filtroDesdeParametro, montoPagadoDe, resumenLista, saldoDe } from './listaPresupuestos'

describe('qué es una venta', () => {
  it('un presupuesto que el cliente ya aceptó', () => {
    for (const s of ['aprobado', 'cobrado', 'parcialmente_pagado', 'pagado']) assert.equal(esVenta(s), true, s)
    for (const s of ['no_enviado', 'enviado', 'no_aprobado', '', null, undefined]) assert.equal(esVenta(s), false, String(s))
  })

  it('el filtro de la dirección: ventas, un estado, o todos', () => {
    assert.equal(filtroDesdeParametro('ventas'), 'ventas')
    assert.equal(filtroDesdeParametro(' Ventas '), 'ventas')
    assert.equal(filtroDesdeParametro('pagado'), 'pagado')
    assert.equal(filtroDesdeParametro('cualquier-cosa'), 'todos')
    assert.equal(filtroDesdeParametro(null), 'todos')
  })
})

describe('totales de la lista', () => {
  const lista = [
    { status: 'no_enviado', subtotal: 100 },
    { status: 'enviado', subtotal: 30000 },
    { status: 'no_aprobado', subtotal: 700 },
    { status: 'aprobado', subtotal: 50 },
    { status: 'cobrado', subtotal: 200 },
    { status: 'parcialmente_pagado', subtotal: 300, monto_pagado: 120, saldo: 180 },
    { status: 'pagado', subtotal: 1000 },
  ]

  it('«por pagar» es solo lo aceptado que falta cobrar: lo enviado todavía no se debe', () => {
    const r = resumenLista(lista)
    assert.equal(r.totalAprobado, 1550)
    assert.equal(r.totalPagado, 1120)
    assert.equal(r.totalPorPagar, 430) // 50 + 200 + 180; sin los 30.000 solo enviados
    assert.equal(r.ventas, 4)
  })

  it('sin datos de abonos, «pagado» cuenta entero y lo demás nada', () => {
    assert.equal(montoPagadoDe({ status: 'pagado', subtotal: '99.50' }), 99.5)
    assert.equal(montoPagadoDe({ status: 'cobrado', subtotal: 80 }), 0)
    assert.equal(saldoDe({ status: 'cobrado', subtotal: 80 }), 80)
    assert.equal(saldoDe({ status: 'pagado', subtotal: 80 }), 0)
    assert.equal(saldoDe({ status: 'parcialmente_pagado', subtotal: 80, monto_pagado: 30 }), 50)
  })

  it('lista vacía', () => {
    assert.deepEqual(resumenLista([]), { totalAprobado: 0, totalPagado: 0, totalPorPagar: 0, ventas: 0 })
  })
})
