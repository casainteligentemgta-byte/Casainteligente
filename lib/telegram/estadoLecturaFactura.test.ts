import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { esIdMensajeTelegram, esLecturaEnCurso } from './estadoLecturaFactura'

const AHORA = Date.parse('2026-11-26T15:00:00.000Z')

describe('esLecturaEnCurso', () => {
  it('cuenta una lectura procesando, sin datos y reciente', () => {
    assert.equal(
      esLecturaEnCurso(
        { estado: 'procesando', extracted: null, updated_at: '2026-11-26T14:59:00.000Z' },
        AHORA,
      ),
      true,
    )
  })

  it('no cuenta una caída (más de 3 min) ni una confirmación contable (ya tiene datos)', () => {
    assert.equal(
      esLecturaEnCurso(
        { estado: 'procesando', extracted: null, updated_at: '2026-11-26T14:55:00.000Z' },
        AHORA,
      ),
      false,
    )
    assert.equal(
      esLecturaEnCurso(
        { estado: 'procesando', extracted: { total_amount: 1 }, updated_at: '2026-11-26T14:59:50.000Z' },
        AHORA,
      ),
      false,
    )
  })

  it('no cuenta otros estados', () => {
    assert.equal(
      esLecturaEnCurso({ estado: 'extraido', extracted: null, updated_at: '2026-11-26T14:59:50.000Z' }, AHORA),
      false,
    )
    assert.equal(esLecturaEnCurso({ estado: 'procesando', updated_at: null }, AHORA), false)
  })
})

describe('esIdMensajeTelegram', () => {
  it('acepta enteros positivos (también como texto de bigint)', () => {
    assert.equal(esIdMensajeTelegram(7465), true)
    assert.equal(esIdMensajeTelegram('7465'), true)
    assert.equal(esIdMensajeTelegram(0), false)
    assert.equal(esIdMensajeTelegram(null), false)
    assert.equal(esIdMensajeTelegram('abc'), false)
  })
})
