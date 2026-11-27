import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FALLBACK_TASA_BCV_VES_POR_USD,
  MENSAJE_CONFIRMACION_BLOQUEADA,
  MODELO_RELECTURA_OCR,
  MULTIPLO_BCV_TOTAL_USD_SOSPECHOSO,
  PRESUPUESTO_MS_RELECTURA_MINIMO,
  UMBRAL_CONFIANZA_REVISION,
  aplicarAlertasAExtracted,
  aplicarPoliticaRelecturaOcr,
  aplicarRevisionManual,
  confianza01,
  confianzaBaja,
  decidirRelecturaFlash,
  elegirMejorLectura,
  mensajeBloqueoConfirmacion,
  monedaInconsistenteBsComoUsd,
  tieneRevisionManual,
  validarLecturaFactura,
} from './validarLecturaFactura'
import { esModeloLiteOcr } from '@/lib/almacen/geminiProcurementModels'

const PLACACENTRO = {
  invoice_number: '00018627',
  supplier_name: 'Placacentro Masisa',
  supplier_rif: 'J-00000000-0',
  total_amount: 135389.41,
  confidence_score: 67,
  modelUsed: 'gemini-2.5-flash-lite',
  items: [
    { description: 'Melamina blanca', quantity: 4, unit_price: 0 },
    { description: 'Canto PVC', quantity: 12, unit_price: 0 },
    { description: 'Tornillo 6x50', quantity: 100, unit_price: 0 },
    { description: 'Pegamento', quantity: 2, unit_price: 40 },
  ],
}

const MANZANILLO = {
  invoice_number: '35412',
  supplier_name: 'Manzanillo',
  supplier_rif: 'J-12345678-9',
  total_amount: 135389.41,
  moneda: 'USD',
  confidence_score: 92,
  items: [
    { description: 'Arena lavada', quantity: 10, unit_price: 13538.941 },
  ],
}

describe('confianza OCR', () => {
  it('normaliza 0–100 y 0–1 al mismo rango', () => {
    assert.equal(confianza01(67), 0.67)
    assert.equal(confianza01(0.67), 0.67)
    assert.equal(confianza01(100), 1)
    assert.equal(confianza01(undefined), null)
  })

  it(`67% está por debajo del umbral ${UMBRAL_CONFIANZA_REVISION}`, () => {
    assert.equal(confianzaBaja(67), true)
    assert.equal(confianzaBaja(80), false)
    assert.equal(confianzaBaja(0.79), true)
    assert.equal(confianzaBaja(0.8), false)
  })
})

describe('validarLecturaFactura', () => {
  it('factura 00018627 Placacentro: precio 0, suma ≠ total y confianza 67%', () => {
    const anom = validarLecturaFactura(PLACACENTRO)
    const tipos = anom.map((a) => a.tipo)
    assert.equal(tipos.filter((t) => t === 'precio_cero').length, 3)
    assert.ok(tipos.includes('suma_lineas_distinta'))
    assert.ok(tipos.includes('confianza_baja'))
    assert.ok(anom.every((a) => a.severidad === 'alerta'))
    assert.ok(mensajeBloqueoConfirmacion(PLACACENTRO)?.startsWith(MENSAJE_CONFIRMACION_BLOQUEADA))
  })

  it('factura 35412 Manzanillo: total en Bs etiquetado USD', () => {
    assert.equal(
      monedaInconsistenteBsComoUsd(MANZANILLO, { tasaBcv: FALLBACK_TASA_BCV_VES_POR_USD }),
      true,
    )
    const anom = validarLecturaFactura(MANZANILLO, { tasaBcv: FALLBACK_TASA_BCV_VES_POR_USD })
    assert.ok(anom.some((a) => a.tipo === 'moneda_inconsistente'))
    assert.match(anom.find((a) => a.tipo === 'moneda_inconsistente')!.mensaje, /bolívares|USD/)
  })

  it('alerta cantidad 0', () => {
    const anom = validarLecturaFactura({
      total_amount: 10,
      items: [{ description: 'Cabilla', quantity: 0, unit_price: 10 }],
    })
    assert.ok(anom.some((a) => a.tipo === 'cantidad_cero'))
  })

  it('acepta suma de líneas + IVA 16 % igual al total', () => {
    const anom = validarLecturaFactura({
      total_amount: 116,
      confidence_score: 95,
      items: [{ description: 'Cemento', quantity: 1, unit_price: 100 }],
    })
    assert.equal(anom.some((a) => a.tipo === 'suma_lineas_distinta'), false)
  })

  it('no marca moneda USD pequeña como inconsistente', () => {
    const anom = validarLecturaFactura({
      supplier_rif: 'J-12345678-9',
      total_amount: 85,
      moneda: 'USD',
      confidence_score: 95,
      items: [{ description: 'Servicio', quantity: 1, unit_price: 85 }],
    })
    assert.equal(anom.some((a) => a.tipo === 'moneda_inconsistente'), false)
  })

  it('detecta indicadores Bs en el texto con moneda USD', () => {
    const anom = validarLecturaFactura(
      {
        supplier_rif: 'J-12345678-9',
        total_amount: 500,
        moneda: 'USD',
        confidence_score: 90,
        items: [{ description: 'Total Bs 500', quantity: 1, unit_price: 500 }],
      },
      { tasaBcv: FALLBACK_TASA_BCV_VES_POR_USD },
    )
    assert.ok(anom.some((a) => a.tipo === 'moneda_inconsistente'))
  })

  it('no aplica precio 0 a una nota de entrega', () => {
    const anom = validarLecturaFactura({
      document_kind: 'nota_entrega',
      total_amount: 0,
      confidence_score: 90,
      items: [{ description: 'Arena', quantity: 3, unit_price: 0 }],
    })
    assert.equal(anom.some((a) => a.tipo === 'precio_cero'), false)
  })
})

describe('decidirRelecturaFlash', () => {
  it('re-lee lite con confianza baja', () => {
    const d = decidirRelecturaFlash({
      modelUsed: 'gemini-2.5-flash-lite',
      confidence: 67,
      alertas: [],
      remainingMs: 90_000,
    })
    assert.equal(d.releer, true)
    assert.equal(d.omitidaPorTiempo, false)
    assert.equal(d.motivo, 'confianza_baja')
  })

  it('re-lee lite si hay alertas aunque la confianza sea alta', () => {
    const d = decidirRelecturaFlash({
      modelUsed: 'gemini-2.5-flash-lite',
      confidence: 95,
      alertas: [{ tipo: 'precio_cero' }],
      remainingMs: 90_000,
    })
    assert.equal(d.releer, true)
    assert.equal(d.motivo, 'alertas')
  })

  it('no re-lee si el modelo no es lite', () => {
    const d = decidirRelecturaFlash({
      modelUsed: 'gemini-2.5-flash',
      confidence: 50,
      alertas: [{ tipo: 'precio_cero' }],
      remainingMs: 90_000,
    })
    assert.equal(d.releer, false)
    assert.equal(d.motivo, 'modelo_no_lite')
  })

  it('omite la re-lectura si el presupuesto de Vercel está agotado y deja marcar revisión', () => {
    const d = decidirRelecturaFlash({
      modelUsed: 'gemini-2.5-flash-lite',
      confidence: 67,
      alertas: [{ tipo: 'precio_cero' }],
      remainingMs: PRESUPUESTO_MS_RELECTURA_MINIMO - 1,
    })
    assert.equal(d.releer, false)
    assert.equal(d.omitidaPorTiempo, true)
    assert.equal(d.motivo, 'presupuesto_tiempo')
  })

  it('no re-lee lite con lectura limpia y confianza alta', () => {
    const d = decidirRelecturaFlash({
      modelUsed: 'gemini-2.5-flash-lite',
      confidence: 92,
      alertas: [],
      remainingMs: 90_000,
    })
    assert.equal(d.releer, false)
    assert.equal(d.motivo, 'lectura_ok')
  })
})

describe('elegirMejorLectura y aplicarPoliticaRelecturaOcr', () => {
  it('prefiere menos alertas y luego mayor confianza', () => {
    const mala = {
      data: { ...PLACACENTRO, confidence_score: 67 },
      modelUsed: 'gemini-2.5-flash-lite',
      alertas: validarLecturaFactura(PLACACENTRO),
    }
    const buena = {
      data: {
        ...PLACACENTRO,
        confidence_score: 91,
        items: [
          { description: 'Melamina blanca', quantity: 4, unit_price: 20000 },
          { description: 'Canto PVC', quantity: 12, unit_price: 2500 },
          { description: 'Tornillo 6x50', quantity: 100, unit_price: 40 },
          { description: 'Pegamento', quantity: 2, unit_price: 594.705 },
        ],
      },
      modelUsed: MODELO_RELECTURA_OCR,
      alertas: [] as ReturnType<typeof validarLecturaFactura>,
    }
    const r = elegirMejorLectura(mala, { ...buena, alertas: validarLecturaFactura(buena.data) })
    assert.equal(r.modelUsed, MODELO_RELECTURA_OCR)
    assert.equal(r.motivo, 'menos_alertas')
  })

  it('no prefiere una re-lectura vacía aunque tenga menos alertas', () => {
    const conLineas = {
      data: PLACACENTRO,
      modelUsed: 'gemini-2.5-flash-lite',
      alertas: validarLecturaFactura(PLACACENTRO),
    }
    const vacia = {
      data: { ...PLACACENTRO, items: [], confidence_score: 99 },
      modelUsed: MODELO_RELECTURA_OCR,
      alertas: [],
    }
    const r = elegirMejorLectura(conLineas, vacia)
    assert.equal(r.modelUsed, 'gemini-2.5-flash-lite')
    assert.equal(r.motivo, 'conservar_lineas')
  })

  it('en empate de alertas gana la mayor confianza', () => {
    const a = {
      data: { confidence_score: 70, items: [] },
      modelUsed: 'lite',
      alertas: [],
    }
    const b = {
      data: { confidence_score: 88, items: [] },
      modelUsed: 'gemini-2.5-flash',
      alertas: [],
    }
    assert.equal(elegirMejorLectura(a, b).modelUsed, 'gemini-2.5-flash')
  })

  it('aplica el segundo pase y se queda con el flash si mejora', async () => {
    const r = await aplicarPoliticaRelecturaOcr({
      primera: { data: PLACACENTRO, modelUsed: 'gemini-2.5-flash-lite' },
      remainingMs: 90_000,
      releer: async () => ({
        data: {
          ...PLACACENTRO,
          confidence_score: 93,
          items: [{ description: 'Melamina blanca', quantity: 1, unit_price: 135389.41 }],
        },
        modelUsed: MODELO_RELECTURA_OCR,
      }),
    })
    assert.equal(r.relectura.intentada, true)
    assert.equal(r.modelUsed, MODELO_RELECTURA_OCR)
    assert.equal(r.relectura.ganador, MODELO_RELECTURA_OCR)
  })

  it('si se acaba el tiempo no llama a releer y anota omitida_por_tiempo', async () => {
    let llamado = 0
    const r = await aplicarPoliticaRelecturaOcr({
      primera: { data: PLACACENTRO, modelUsed: 'gemini-2.5-flash-lite' },
      remainingMs: 1_000,
      releer: async () => {
        llamado += 1
        return { data: PLACACENTRO, modelUsed: MODELO_RELECTURA_OCR }
      },
    })
    assert.equal(llamado, 0)
    assert.equal(r.relectura.omitida_por_tiempo, true)
    assert.equal(r.modelUsed, 'gemini-2.5-flash-lite')
  })
})

describe('revisión manual y bloqueo de confirmación', () => {
  it('el override autorizado desbloquea aunque sigan las alertas', () => {
    const conOverride = aplicarRevisionManual(PLACACENTRO, {
      userId: 'user-1',
      email: 'contador@casa.com',
    })
    assert.equal(tieneRevisionManual(conOverride), true)
    assert.equal(mensajeBloqueoConfirmacion(conOverride), null)
    const aplicado = aplicarAlertasAExtracted(conOverride, validarLecturaFactura(conOverride))
    assert.equal(aplicado.requiere_revision, false)
    assert.ok(aplicado.extracted.revision_manual?.por_email)
  })

  it('editar precios a valores que cuadran quita el bloqueo', () => {
    const corregida = {
      ...PLACACENTRO,
      confidence_score: 90,
      items: [
        { description: 'Melamina blanca', quantity: 1, unit_price: 135389.41 },
      ],
    }
    assert.equal(mensajeBloqueoConfirmacion(corregida), null)
    assert.equal(validarLecturaFactura(corregida).length, 0)
  })

  it('requiere_revision queda true si hay alertas y no hay override', () => {
    const r = aplicarAlertasAExtracted(PLACACENTRO, validarLecturaFactura(PLACACENTRO))
    assert.equal(r.requiere_revision, true)
  })
})

describe('esModeloLiteOcr', () => {
  it('reconoce flash-lite y no flash-latest', () => {
    assert.equal(esModeloLiteOcr('gemini-2.5-flash-lite'), true)
    assert.equal(esModeloLiteOcr('gemini-flash-latest'), false)
    assert.equal(esModeloLiteOcr('gemini-2.5-flash'), false)
    assert.equal(esModeloLiteOcr(''), false)
  })
})

describe('constantes de política', () => {
  it('documenta umbral 0.80, modelo flash y múltiplo BCV', () => {
    assert.equal(UMBRAL_CONFIANZA_REVISION, 0.8)
    assert.equal(MODELO_RELECTURA_OCR, 'gemini-2.5-flash')
    assert.equal(MULTIPLO_BCV_TOTAL_USD_SOSPECHOSO, 20)
    assert.ok(PRESUPUESTO_MS_RELECTURA_MINIMO >= 30_000)
  })
})
