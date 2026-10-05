import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calibrationInputPlaceholder,
  parseCalibrationInput,
  parseCalibrationToMeters,
} from './units'

describe('parseCalibrationInput', () => {
  it('acepta coma venezolana, punto y sufijo m', () => {
    assert.equal(parseCalibrationInput('4,40', 'metric'), 4.4)
    assert.equal(parseCalibrationInput('4.40', 'metric'), 4.4)
    assert.equal(parseCalibrationInput('4,40 m', 'metric'), 4.4)
    assert.equal(parseCalibrationInput('4.40m', 'metric'), 4.4)
    assert.equal(parseCalibrationInput('10', 'metric'), 10)
  })

  it('no inventa metros si el campo está vacío o no se entiende', () => {
    assert.equal(parseCalibrationInput('', 'metric'), null)
    assert.equal(parseCalibrationInput('  ', 'metric'), null)
    assert.equal(parseCalibrationInput('abc', 'metric'), null)
    assert.equal(parseCalibrationInput('0', 'metric'), null)
  })

  it('en imperial convierte pies a metros', () => {
    const m = parseCalibrationInput('10', 'imperial')
    assert.ok(m != null)
    assert.ok(Math.abs(m - 3.048) < 1e-9)
    const fromFt = parseCalibrationInput('10 ft', 'metric')
    assert.ok(fromFt != null)
    assert.ok(Math.abs(fromFt - 3.048) < 1e-9)
  })
})

describe('parseCalibrationToMeters', () => {
  it('sigue aceptando 4,40 (antes Number() daba NaN y caía a 10)', () => {
    assert.equal(parseCalibrationToMeters('4,40', 'metric'), 4.4)
  })

  it('vacío cae a 10 m por compatibilidad', () => {
    assert.equal(parseCalibrationToMeters('', 'metric'), 10)
  })
})

describe('calibrationInputPlaceholder', () => {
  it('sugiere cota con coma en métrico', () => {
    assert.equal(calibrationInputPlaceholder('metric'), 'ej. 4,40')
    assert.equal(calibrationInputPlaceholder('imperial'), 'ej. 33')
  })
})
