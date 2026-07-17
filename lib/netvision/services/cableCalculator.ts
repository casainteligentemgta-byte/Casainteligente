/** Stub Fase 4 — cálculo de metros y tipo de cable. */
export function recommendCableType(lengthM: number): 'CAT5E' | 'CAT6' | 'CAT6A' | 'FIBER' {
  if (lengthM > 100) return 'FIBER'
  if (lengthM > 55) return 'CAT6'
  if (lengthM > 30) return 'CAT6A'
  return 'CAT5E'
}
