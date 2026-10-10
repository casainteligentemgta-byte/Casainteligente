import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  construirRendicion,
  esFechaIso,
  fechaCorta,
  hoyCaracas,
  moverPeriodo,
  nombreArchivoRendicion,
  rangoRendicion,
  type MovimientoRendicion,
} from './rendicionHonorarios'
import { aporteDesdeInyeccion, gastoDesdeCompra } from './cargarRendicionHonorarios'
import { leerParametrosRendicion } from './parametrosRendicion'

let n = 0
function gasto(fecha: string | null, baseUsd: number, extra: Partial<MovimientoRendicion> = {}): MovimientoRendicion {
  n += 1
  return {
    id: `g${n}`,
    clase: 'GASTO',
    fecha,
    proveedor: 'Ferretería X',
    concepto: 'Cemento',
    factura: `F-${n}`,
    tipo: 'MATERIALES',
    capitulo: 'Estructura',
    baseUsd,
    honorariosUsd: Math.round(baseUsd * 15) / 100,
    honorariosGuardados: true,
    estado: 'PAGADO',
    formaPago: null,
    tieneSoporte: true,
    ...extra,
  }
}

function aporte(fecha: string | null, baseUsd: number): MovimientoRendicion {
  n += 1
  return {
    id: `a${n}`,
    clase: 'INGRESO',
    fecha,
    proveedor: 'CLIENTE',
    concepto: 'Aporte',
    factura: null,
    tipo: 'INGRESO',
    capitulo: '—',
    baseUsd,
    honorariosUsd: 0,
    honorariosGuardados: true,
    estado: 'RECIBIDO',
    formaPago: 'ZELLE',
    tieneSoporte: false,
  }
}

describe('períodos de la rendición', () => {
  it('la semana va de lunes a domingo', () => {
    // 15/07/2026 es miércoles.
    assert.deepEqual(rangoRendicion('semana', '2026-07-15'), {
      tipo: 'semana',
      desde: '2026-07-13',
      hasta: '2026-07-19',
      etiqueta: 'Semana del 13/07/2026 al 19/07/2026',
    })
    // Un domingo pertenece a la semana que termina ese día; un lunes abre la siguiente.
    assert.equal(rangoRendicion('semana', '2026-07-19').desde, '2026-07-13')
    assert.equal(rangoRendicion('semana', '2026-07-20').desde, '2026-07-20')
    // Semana que cruza de mes y de año.
    assert.deepEqual(
      [rangoRendicion('semana', '2027-01-01').desde, rangoRendicion('semana', '2027-01-01').hasta],
      ['2026-12-28', '2027-01-03'],
    )
  })

  it('el mes es el mes calendario, con febrero y bisiestos', () => {
    assert.deepEqual(rangoRendicion('mes', '2026-07-15'), {
      tipo: 'mes',
      desde: '2026-07-01',
      hasta: '2026-07-31',
      etiqueta: 'Julio de 2026',
    })
    assert.equal(rangoRendicion('mes', '2026-02-10').hasta, '2026-02-28')
    assert.equal(rangoRendicion('mes', '2028-02-10').hasta, '2028-02-29')
  })

  it('toda la obra no tiene fechas límite', () => {
    assert.deepEqual(rangoRendicion('obra', '2026-07-15'), {
      tipo: 'obra',
      desde: null,
      hasta: null,
      etiqueta: 'Toda la obra',
    })
  })

  it('anterior y siguiente saltan un período completo', () => {
    assert.equal(moverPeriodo('semana', '2026-07-15', -1), '2026-07-08')
    assert.equal(moverPeriodo('semana', '2026-12-30', 1), '2027-01-06')
    // Desde el día 31 no se salta un mes (31 de enero + 1 mes no existe).
    assert.equal(moverPeriodo('mes', '2026-01-31', 1), '2026-02-01')
    assert.equal(moverPeriodo('mes', '2026-01-15', -1), '2025-12-01')
  })

  it('valida fechas y da el día de Venezuela', () => {
    assert.equal(esFechaIso('2026-02-30'), false)
    assert.equal(esFechaIso('2026-2-3'), false)
    assert.equal(esFechaIso('2026-02-28'), true)
    assert.equal(fechaCorta('2026-07-13'), '13/07/2026')
    // 02:00 UTC del día 11 todavía es día 10 en Caracas (UTC−4).
    assert.equal(hoyCaracas(new Date('2026-10-11T02:00:00Z')), '2026-10-10')
    assert.equal(hoyCaracas(new Date('2026-10-11T04:00:00Z')), '2026-10-11')
  })

  it('lee los parámetros de la consulta con valores seguros por defecto', () => {
    const p = leerParametrosRendicion('https://x.test/api?proyecto=abc&periodo=semana&fecha=2026-07-15&version=cliente')
    assert.deepEqual(p, { proyectoId: 'abc', periodo: 'semana', fecha: '2026-07-15', version: 'cliente' })

    const d = leerParametrosRendicion('https://x.test/api?periodo=raro&fecha=ayer&version=otra')
    assert.equal(d.proyectoId, null)
    assert.equal(d.periodo, 'mes')
    assert.equal(d.version, 'interna')
    assert.equal(esFechaIso(d.fecha), true)
  })
})

describe('cuentas de la rendición', () => {
  const movimientos = [
    aporte('2026-06-20', 1000),
    gasto('2026-06-25', 400), // honorarios 60 → saldo al cierre de junio: 1000 − 460 = 540
    aporte('2026-07-02', 500),
    gasto('2026-07-13', 200, { tipo: 'MATERIALES' }), // 30
    gasto('2026-07-15', 100, { tipo: 'MANO DE OBRA', tieneSoporte: false, estado: 'PENDIENTE' }), // 15
    gasto('2026-07-19', 60, { tipo: 'MATERIALES', honorariosUsd: 6, honorariosGuardados: false }), // 10 %
    gasto('2026-07-20', 1000), // fuera de la semana del 13 al 19
    gasto('2026-08-03', 50),
  ]

  it('semana: saldo anterior + aportes − gastos − honorarios', () => {
    const r = construirRendicion({ movimientos, rango: rangoRendicion('semana', '2026-07-15'), pctPactado: 15 })

    // Antes del 13/07: aportes 1500, gastos 400, honorarios 60.
    assert.equal(r.saldoAnterior, 1040)
    assert.deepEqual(r.periodo, { aportes: 0, gastos: 360, honorarios: 51, total: 411, nAportes: 0, nGastos: 3 })
    assert.equal(r.saldoFinal, 629)
    assert.deepEqual(
      r.gastos.map((g) => g.fecha),
      ['2026-07-13', '2026-07-15', '2026-07-19'],
    )
    // El acumulado llega hasta el domingo 19; no incluye el gasto del lunes 20.
    assert.equal(r.acumulado.gastos, 760)
    assert.equal(r.acumulado.saldo, 629)
  })

  it('el saldo final de un período es el saldo anterior del siguiente', () => {
    const julio = construirRendicion({ movimientos, rango: rangoRendicion('mes', '2026-07-10'), pctPactado: 15 })
    const agosto = construirRendicion({ movimientos, rango: rangoRendicion('mes', '2026-08-10'), pctPactado: 15 })

    assert.equal(julio.saldoAnterior, 540)
    assert.equal(julio.periodo.aportes, 500)
    assert.equal(julio.periodo.gastos, 1360)
    assert.equal(julio.periodo.honorarios, 201)
    assert.equal(julio.saldoFinal, -521)
    assert.equal(agosto.saldoAnterior, julio.saldoFinal)
  })

  it('toda la obra coincide con la suma de sus meses', () => {
    const obra = construirRendicion({ movimientos, rango: rangoRendicion('obra', '2026-07-15'), pctPactado: 15 })

    assert.equal(obra.saldoAnterior, 0)
    assert.equal(obra.periodo.aportes, 1500)
    assert.equal(obra.periodo.gastos, 1810)
    assert.equal(obra.periodo.honorarios, 268.5)
    assert.equal(obra.saldoFinal, -578.5)
    assert.deepEqual(
      obra.porMes.map((m) => [m.periodo, m.saldo]),
      [
        ['2026-06', 540],
        ['2026-07', -521],
        ['2026-08', -578.5],
      ],
    )
    assert.equal(obra.porMes.at(-1)?.saldo, obra.saldoFinal)
    assert.equal(obra.ultimoMovimiento, '2026-08-03')
  })

  it('agrupa por tipo, de mayor a menor', () => {
    const r = construirRendicion({ movimientos, rango: rangoRendicion('semana', '2026-07-15'), pctPactado: 15 })
    assert.deepEqual(r.porTipo, [
      { nombre: 'MATERIALES', gastos: 260, honorarios: 36, total: 296, n: 2 },
      { nombre: 'MANO DE OBRA', gastos: 100, honorarios: 15, total: 115, n: 1 },
    ])
    const sumaTipos = r.porTipo.reduce((a, t) => a + t.total, 0)
    assert.equal(sumaTipos, r.periodo.total)
  })

  it('control interno: sin soporte, no pagados y honorarios fuera de lo pactado', () => {
    const r = construirRendicion({ movimientos, rango: rangoRendicion('semana', '2026-07-15'), pctPactado: 15 })
    assert.deepEqual(r.control.sinSoporte, { n: 1, monto: 100 })
    assert.deepEqual(r.control.noPagados, { n: 1, monto: 100 })
    assert.deepEqual(r.control.honorariosCalculados, { n: 1, monto: 60, honorarios: 6 })
    assert.deepEqual(r.control.pctDistinto, { n: 1, monto: 60 })
    assert.equal(r.pctEfectivo, 14.17)
  })

  it('un movimiento sin fecha solo cuenta en toda la obra, y se avisa', () => {
    const conHuérfano = [...movimientos, gasto(null, 70)]
    const semana = construirRendicion({ movimientos: conHuérfano, rango: rangoRendicion('semana', '2026-07-15'), pctPactado: 15 })
    const obra = construirRendicion({ movimientos: conHuérfano, rango: rangoRendicion('obra', ''), pctPactado: 15 })

    assert.equal(semana.periodo.gastos, 360)
    assert.equal(semana.saldoAnterior, 1040)
    assert.deepEqual(semana.control.sinFecha, { n: 1, monto: 70 })
    assert.equal(obra.periodo.gastos, 1880)
  })

  it('período sin movimientos: todo en cero y conserva el saldo', () => {
    const r = construirRendicion({ movimientos, rango: rangoRendicion('semana', '2026-10-07'), pctPactado: 15 })
    assert.equal(r.periodo.nGastos + r.periodo.nAportes, 0)
    assert.equal(r.saldoAnterior, -578.5)
    assert.equal(r.saldoFinal, -578.5)
    assert.equal(r.ultimoMovimiento, '2026-08-03')
  })

  it('no acumula error de centavos con muchos gastos', () => {
    const muchos = Array.from({ length: 3000 }, (_, i) =>
      gasto('2026-07-14', 0.1, { id: `m${i}`, honorariosUsd: 0.015 }),
    )
    const r = construirRendicion({ movimientos: muchos, rango: rangoRendicion('mes', '2026-07-14'), pctPactado: 15 })
    assert.equal(r.periodo.gastos, 300)
    assert.equal(r.periodo.honorarios, 45)
    assert.equal(r.periodo.total, 345)
  })

  it('nombre del archivo según período y versión', () => {
    assert.equal(
      nombreArchivoRendicion('Rancho Flamboyant – 2ª etapa', rangoRendicion('mes', '2026-07-15'), 'cliente'),
      'Rendicion_Rancho_Flamboyant_2_etapa_2026-07_cliente.pdf',
    )
    assert.equal(
      nombreArchivoRendicion('Obra', rangoRendicion('semana', '2026-07-15'), 'interna'),
      'Rendicion_Obra_2026-07-13_a_2026-07-19_interna.pdf',
    )
    assert.equal(
      nombreArchivoRendicion('', rangoRendicion('obra', ''), 'interna'),
      'Rendicion_obra_toda_la_obra_interna.pdf',
    )
  })
})

describe('qué filas del CCO entran en la rendición', () => {
  const base = {
    id: 'c1',
    fecha: '2026-07-11',
    supplier_name: 'Ferretería EPA, C.A.',
    invoice_number: '00123',
    notas: 'Cabillas 1/2',
    monto_usd: 200,
    honorarios_usd: 30,
    cco_estado: 'PAGADO',
  }

  it('un gasto normal entra con sus honorarios guardados', () => {
    const g = gastoDesdeCompra(base, 15)
    assert.equal(g?.baseUsd, 200)
    assert.equal(g?.honorariosUsd, 30)
    assert.equal(g?.honorariosGuardados, true)
    assert.equal(g?.concepto, 'Cabillas 1/2')
    assert.equal(g?.tieneSoporte, false)
  })

  it('sin honorarios guardados se calculan con el % pactado, o con el % propio de la fila', () => {
    const calculado = gastoDesdeCompra({ ...base, honorarios_usd: null }, 15)
    assert.equal(calculado?.honorariosUsd, 30)
    assert.equal(calculado?.honorariosGuardados, false)

    const propio = gastoDesdeCompra({ ...base, honorarios_usd: null, admin_pct_override: 10 }, 15)
    assert.equal(propio?.honorariosUsd, 20)
  })

  it('las filas de bitácora del programa viejo no son gastos', () => {
    // Fila sintética del histórico: factura SIN-*, nota genérica de importación.
    assert.equal(
      gastoDesdeCompra(
        { ...base, invoice_number: 'SIN-000456', notas: 'Importación desde tabla histórica', honorarios_usd: null },
        15,
      ),
      null,
    )
    assert.equal(gastoDesdeCompra({ ...base, notas: 'INICIO DE SESIÓN: accedió al sistema' }, 15), null)
  })

  it('anulados y montos en cero no entran', () => {
    assert.equal(gastoDesdeCompra({ ...base, cco_estado: 'ANULADO' }, 15), null)
    assert.equal(gastoDesdeCompra({ ...base, monto_usd: 0 }, 15), null)
  })

  it('un gasto solo en bolívares se convierte con su tasa', () => {
    const g = gastoDesdeCompra(
      { ...base, monto_usd: 0, monto_ves: 4000, tasa_bcv_ves_por_usd: 40, honorarios_usd: null },
      15,
    )
    assert.equal(g?.baseUsd, 100)
    assert.equal(g?.honorariosUsd, 15)
  })

  it('con factura adjunta cuenta como soportado', () => {
    assert.equal(gastoDesdeCompra({ ...base, document_storage_path: 'a/b.pdf' }, 15)?.tieneSoporte, true)
    assert.equal(gastoDesdeCompra({ ...base, purchase_invoice_id: 'pi-1' }, 15)?.tieneSoporte, true)
  })

  it('los aportes del cliente entran sin honorarios', () => {
    const a = aporteDesdeInyeccion({
      id: 'i1',
      fecha_ingreso: '2026-07-02T10:00:00Z',
      monto_usd: 500,
      origen_fondo: 'CCO-V4 #12 · CLIENTE · Aporte semana 20',
      metodo_pago: 'ZELLE',
    })
    assert.equal(a?.fecha, '2026-07-02')
    assert.equal(a?.baseUsd, 500)
    assert.equal(a?.honorariosUsd, 0)
    assert.equal(a?.proveedor, 'CLIENTE')
    assert.equal(a?.concepto, 'Aporte semana 20')
    assert.equal(aporteDesdeInyeccion({ id: 'i2', monto_usd: 0 }), null)
  })
})
