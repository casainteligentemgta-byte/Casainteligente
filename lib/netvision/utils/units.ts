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

/** Interpreta valor de calibración ingresado por el usuario → metros. */
export function parseCalibrationToMeters(
  value: string | number,
  system: UnitSystem,
): number {
  const n = typeof value === 'number' ? value : Number(value)
  const safe = Number.isFinite(n) && n > 0 ? n : 10
  if (system === 'imperial') return Math.max(0.5, feetToMeters(safe))
  return Math.max(0.5, safe)
}

/** Valor sugerido para el input de calibración según sistema. */
export function defaultCalibrationInput(system: UnitSystem): string {
  return system === 'imperial' ? '33' : '10'
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
