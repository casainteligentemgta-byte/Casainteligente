/** Cálculo de tipo de cable por distancia (Fase 2/4). */
export function recommendCableType(
  lengthM: number,
): 'CAT5E' | 'CAT6' | 'CAT6A' | 'FIBER' {
  if (lengthM > 100) return 'FIBER'
  if (lengthM > 55) return 'CAT6'
  if (lengthM > 30) return 'CAT6A'
  return 'CAT6'
}

export function cableWarning(lengthM: number): string | null {
  if (lengthM > 100) {
    return 'Supera 100 m — usar fibra o repetidor PoE'
  }
  if (lengthM > 90) {
    return 'Cerca del límite TIA 100 m — deja margen de servicio'
  }
  return null
}
