import type { UnitSystem } from '@/lib/netvision/types'

const M_PER_FT = 0.3048
const MM_PER_IN = 25.4

export function metersToFeet(m: number): number {
  return m / M_PER_FT
}

export function feetToMeters(ft: number): number {
  return ft * M_PER_FT
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_IN
}

export function inchesToMm(inches: number): number {
  return inches * MM_PER_IN
}

/** Etiqueta corta de distancia según sistema. */
export function lengthUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'ft' : 'm'
}

/**
 * Formatea metros internos para UI.
 * - metric / mixed: metros
 * - imperial: pies
 */
export function formatLength(
  meters: number,
  system: UnitSystem,
  digits = 1,
): string {
  if (!Number.isFinite(meters)) return '—'
  if (system === 'imperial') {
    return `${metersToFeet(meters).toFixed(digits)} ft`
  }
  return `${meters.toFixed(digits)} m`
}

/**
 * Interpreta el metraje que el usuario escribe al calibrar.
 * Acepta 4,40 · 4.40 · 4.40 m · 10 ft. Devuelve metros, o null si está vacío
 * o no se entiende (no inventa 10 m).
 */
export function parseCalibrationInput(
  value: string | number,
  system: UnitSystem,
): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    return system === 'imperial' ? feetToMeters(value) : value
  }
  const raw = value.trim()
  if (!raw) return null
  let s = raw.replace(/\s+/g, '').replace(/,/g, '.')
  let asImperial = system === 'imperial'
  const pieRe = /(?:pies|pie|ft|')$/i
  const metroRe = /(?:metros|metro|mts|mt|m)$/i
  if (pieRe.test(s)) {
    asImperial = true
    s = s.replace(pieRe, '')
  } else if (metroRe.test(s)) {
    asImperial = false
    s = s.replace(metroRe, '')
  }
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return asImperial ? feetToMeters(n) : n
}

/** Interpreta valor de calibración ingresado por el usuario → metros. */
export function parseCalibrationToMeters(
  value: string | number,
  system: UnitSystem,
): number {
  const parsed = parseCalibrationInput(value, system)
  if (parsed != null) return Math.max(0.5, parsed)
  return system === 'imperial' ? Math.max(0.5, feetToMeters(10)) : 10
}

/** Valor sugerido para el input de calibración según sistema. */
export function defaultCalibrationInput(system: UnitSystem): string {
  return system === 'imperial' ? '33' : '10'
}

/** Placeholder del campo de metros al calibrar. */
export function calibrationInputPlaceholder(system: UnitSystem): string {
  return system === 'imperial' ? 'ej. 33' : 'ej. 4,40'
}

export function formatDepth(
  cm: number,
  system: UnitSystem,
  digits = 0,
): string {
  if (system === 'imperial' || system === 'mixed') {
    const inches = cm / 2.54
    return `${inches.toFixed(digits)}"`
  }
  return `${cm.toFixed(digits)} cm`
}

export function formatConduitDiameter(
  mm: number,
  system: UnitSystem,
  digits = 2,
): string {
  if (system === 'imperial' || system === 'mixed') {
    return `${mmToInches(mm).toFixed(digits)}"`
  }
  return `${mm.toFixed(0)} mm`
}

export const UNIT_SYSTEM_OPTIONS: {
  id: UnitSystem
  label: string
  hint: string
}[] = [
  {
    id: 'metric',
    label: 'Métrico',
    hint: 'm, cm, mm, °C',
  },
  {
    id: 'imperial',
    label: 'Imperial',
    hint: 'ft, pulgadas, °F',
  },
  {
    id: 'mixed',
    label: 'Mixto',
    hint: 'm + pulgadas (construcción)',
  },
]
