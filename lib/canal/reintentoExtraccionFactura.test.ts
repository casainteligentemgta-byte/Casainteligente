import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BACKOFF_MS_POR_REINTENTO,
  MAX_INTENTOS_OCR,
  columnasOcrDesconocidas,
  esCandidatoReintentoOcr,
  esErrorExtraccionNoTransitorio,
  esErrorExtraccionTransitorio,
  extraerConReintentos,
  listarPendientesOcrReintento,
  payloadProgresoOcr,
} from './reintentoExtraccionFactura'

describe('esErrorExtraccionTransitorio', () => {
  it('marca los fallos reales de Neo (fetch failed, IA vacía, Gateway Timeout)', () => {
    assert.equal(esErrorExtraccionTransitorio('fetch failed'), true)
    assert.equal(esErrorExtraccionTransitorio(new Error('TypeError: fetch failed')), true)
    assert.equal(
      esErrorExtraccionTransitorio('La IA no devolvió datos del documento.'),
      true,
    )
    assert.equal(esErrorExtraccionTransitorio('Gateway Timeout'), true)
    assert.equal(esErrorExtraccionTransitorio({ message: 'timeout', status: 504 }), true)
  })

  it('marca 429/503 y JSON inválido de la IA', () => {
    assert.equal(esErrorExtraccionTransitorio({ message: 'quota', status: 429 }), true)
    assert.equal(esErrorExtraccionTransitorio('El modelo gemini-2.5-flash está saturado.'), true)
    assert.equal(
      esErrorExtraccionTransitorio(
        'La IA devolvió un formato no válido. Intente con otra imagen o PDF más legible.',
      ),
      true,
    )
    assert.equal(
      esErrorExtraccionTransitorio(
        Object.assign(new Error('Gemini no devolvió texto utilizable.'), { retryable: true }),
      ),
      true,
    )
  })

  it('no reintenta foto ilegible real ni “no es factura”', () => {
    assert.equal(
      esErrorExtraccionTransitorio(
        'No se pudieron leer datos del documento. Use una foto más nítida o un PDF con texto seleccionable.',
      ),
      false,
    )
    assert.equal(esErrorExtraccionNoTransitorio('Esto no es una factura'), true)
    assert.equal(esErrorExtraccionTransitorio('Esto no es una factura'), false)
    assert.equal(
      esErrorExtraccionTransitorio('Falta una parte de la factura (totales no cuadran).'),
      false,
    )
    assert.equal(esErrorExtraccionTransitorio('GEMINI_API_KEY no está configurada.'), false)
  })
})

describe('payloadProgresoOcr', () => {
  const ahora = new Date('2026-11-11T12:00:00.000Z')

  it('en reintento queda procesando y guarda el número de intentos', () => {
    const p = payloadProgresoOcr({
      intentos: 1,
      mensajeError: 'fetch failed',
      fase: 'reintento',
      ahora,
    })
    assert.equal(p.estado, 'procesando')
    assert.equal(p.ocr_intentos, 1)
    assert.equal(p.ocr_proximo_reintento_at, null)
    assert.equal(p.mensaje_error, 'fetch failed')
  })

  it('al diferir pasa a error_ocr con próximo intento (sin avisar aún)', () => {
    const p = payloadProgresoOcr({
      intentos: 2,
      mensajeError: 'Gateway Timeout',
      fase: 'diferir',
      ahora,
      backoffDiferidoMs: 8_000,
    })
    assert.equal(p.estado, 'error_ocr')
    assert.equal(p.ocr_intentos, 2)
    assert.equal(p.ocr_proximo_reintento_at, '2026-11-11T12:00:08.000Z')
  })

  it('al agotar los 3 intentos pasa a error', () => {
    const p = payloadProgresoOcr({
      intentos: 3,
      mensajeError: 'fetch failed',
      fase: 'agotar',
      ahora,
    })
    assert.equal(p.estado, 'error')
    assert.equal(p.ocr_intentos, 3)
    assert.equal(p.ocr_proximo_reintento_at, null)
  })
})

describe('extraerConReintentos', () => {
  it('reintenta 2 veces un fetch failed y usa la misma extracción (foto ya guardada)', async () => {
    let n = 0
    const sleeps: number[] = []
    const r = await extraerConReintentos({
      extraer: async () => {
        n += 1
        if (n < 3) throw new Error('fetch failed')
        return { invoice_number: 'A-1', album_partes: 2 }
      },
      dormir: async (ms) => {
        sleeps.push(ms)
      },
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.data.invoice_number, 'A-1')
      assert.equal(r.data.album_partes, 2)
      assert.equal(r.intentos, 3)
    }
    assert.equal(n, 3)
    assert.deepEqual(sleeps, [BACKOFF_MS_POR_REINTENTO[1], BACKOFF_MS_POR_REINTENTO[2]])
  })

  it('no reintenta una foto ilegible: un solo intento', async () => {
    let n = 0
    const r = await extraerConReintentos({
      extraer: async () => {
        n += 1
        throw new Error(
          'No se pudieron leer datos del documento. Use una foto más nítida o un PDF con texto seleccionable.',
        )
      },
      dormir: async () => {
        throw new Error('no debía esperar')
      },
    })
    assert.equal(n, 1)
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.diferido, false)
      assert.equal(r.transitorio, false)
      assert.equal(r.intentos, 1)
    }
  })

  it('tras 3 fallos transitorios no diferir: el caller avisa al cargador', async () => {
    const r = await extraerConReintentos({
      extraer: async () => {
        throw new Error('La IA no devolvió datos del documento.')
      },
      dormir: async () => {},
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.intentos, MAX_INTENTOS_OCR)
      assert.equal(r.diferido, false)
      assert.equal(r.transitorio, true)
    }
  })

  it('a los 90 s sigue reintentando en la misma invocación (no espera al cron diario)', async () => {
    let n = 0
    const sleeps: number[] = []
    const r = await extraerConReintentos({
      extraer: async () => {
        n += 1
        if (n < 3) throw new Error('fetch failed')
        return { ok: true }
      },
      startedAt: 0,
      ahora: () => 90_000,
      dormir: async (ms) => {
        sleeps.push(ms)
      },
    })
    assert.equal(r.ok, true)
    assert.equal(n, 3)
    assert.deepEqual(sleeps, [BACKOFF_MS_POR_REINTENTO[1], BACKOFF_MS_POR_REINTENTO[2]])
  })

  it('si un intento ya ocupó casi todo el maxDuration, diferir para encadenar (no el cron diario)', async () => {
    const ahora = () => 200_000
    const r = await extraerConReintentos({
      extraer: async () => {
        throw new Error('Gateway Timeout')
      },
      startedAt: 0,
      ahora,
      presupuestoMs: 150_000,
      dormir: async () => {
        throw new Error('no debía esperar: hay que encadenar')
      },
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.diferido, true)
      assert.equal(r.intentos, 1)
      assert.equal(r.transitorio, true)
    }
  })

  it('respeta intentos previos (cron hace solo el intento que falta)', async () => {
    let n = 0
    const r = await extraerConReintentos({
      extraer: async () => {
        n += 1
        throw new Error('fetch failed')
      },
      intentosPrevios: 2,
      dormir: async () => {
        throw new Error('no debía esperar')
      },
    })
    assert.equal(n, 1)
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.intentos, 3)
      assert.equal(r.diferido, false)
    }
  })
})

describe('esCandidatoReintentoOcr', () => {
  const base = {
    id: 'p1',
    document_storage_path: 'telegram-pending/p1.jpg',
  }

  it('toma error_ocr con intentos pendientes cuando ya pasó el backoff', () => {
    assert.equal(
      esCandidatoReintentoOcr(
        {
          ...base,
          estado: 'error_ocr',
          ocr_intentos: 2,
          ocr_proximo_reintento_at: '2026-11-11T12:00:00.000Z',
        },
        Date.parse('2026-11-11T12:00:10.000Z'),
      ),
      true,
    )
  })

  it('forzar ignora la hora para el encadenado en segundos', () => {
    assert.equal(
      esCandidatoReintentoOcr(
        {
          ...base,
          estado: 'error_ocr',
          ocr_intentos: 2,
          ocr_proximo_reintento_at: '2026-11-11T12:01:00.000Z',
        },
        Date.parse('2026-11-11T12:00:00.000Z'),
        { forzar: true },
      ),
      true,
    )
  })

  it('no toma error_ocr si aún no llega la hora o ya hubo 3 intentos', () => {
    assert.equal(
      esCandidatoReintentoOcr(
        {
          ...base,
          estado: 'error_ocr',
          ocr_intentos: 2,
          ocr_proximo_reintento_at: '2026-11-11T12:01:00.000Z',
        },
        Date.parse('2026-11-11T12:00:00.000Z'),
      ),
      false,
    )
    assert.equal(
      esCandidatoReintentoOcr({
        ...base,
        estado: 'error_ocr',
        ocr_intentos: 3,
      }),
      false,
    )
  })

  it('toma procesando obsoleto con intentos pendientes (timeout serverless)', () => {
    assert.equal(
      esCandidatoReintentoOcr(
        {
          ...base,
          estado: 'procesando',
          ocr_intentos: 1,
          updated_at: '2026-11-11T11:50:00.000Z',
        },
        Date.parse('2026-11-11T12:00:00.000Z'),
      ),
      true,
    )
    assert.equal(
      esCandidatoReintentoOcr(
        {
          ...base,
          estado: 'procesando',
          ocr_intentos: 1,
          updated_at: '2026-11-11T11:59:30.000Z',
        },
        Date.parse('2026-11-11T12:00:00.000Z'),
      ),
      false,
    )
  })

  it('exige archivo en storage (álbum o foto única)', () => {
    assert.equal(
      esCandidatoReintentoOcr({
        id: 'p2',
        estado: 'error_ocr',
        ocr_intentos: 1,
        document_parts: [
          { orden: 0, storage_path: 'a.jpg' },
          { orden: 1, storage_path: 'b.jpg' },
        ],
      }),
      true,
    )
    assert.equal(
      esCandidatoReintentoOcr({
        id: 'p3',
        estado: 'error_ocr',
        ocr_intentos: 1,
      }),
      false,
    )
  })
})

describe('listarPendientesOcrReintento', () => {
  it('filtra en memoria y respeta el límite', async () => {
    const filas = [
      {
        id: 'vieja',
        estado: 'error_ocr',
        ocr_intentos: 1,
        ocr_proximo_reintento_at: '2026-11-11T11:00:00.000Z',
        document_storage_path: 'a.jpg',
        updated_at: '2026-11-11T11:00:00.000Z',
      },
      {
        id: 'futura',
        estado: 'error_ocr',
        ocr_intentos: 1,
        ocr_proximo_reintento_at: '2026-11-11T13:00:00.000Z',
        document_storage_path: 'b.jpg',
        updated_at: '2026-11-11T12:00:00.000Z',
      },
      {
        id: 'agotada',
        estado: 'error_ocr',
        ocr_intentos: 3,
        document_storage_path: 'c.jpg',
        updated_at: '2026-11-11T11:00:00.000Z',
      },
    ]
    const fake = {
      from() {
        return {
          select() {
            return {
              in() {
                return {
                  order() {
                    return {
                      limit: async () => ({ data: filas, error: null }),
                    }
                  },
                }
              },
            }
          },
        }
      },
    } as unknown as SupabaseClient

    const out = await listarPendientesOcrReintento(fake, {
      limite: 5,
      ahora: new Date('2026-11-11T12:00:00.000Z'),
    })
    assert.deepEqual(
      out.map((r) => r.id),
      ['vieja'],
    )
  })
})

describe('columnasOcrDesconocidas', () => {
  it('reconoce PGRST204 de migración aún no aplicada', () => {
    assert.equal(columnasOcrDesconocidas('Could not find the ocr_intentos column'), true)
    assert.equal(columnasOcrDesconocidas('PGRST204'), true)
    assert.equal(columnasOcrDesconocidas('permission denied'), false)
  })
})
