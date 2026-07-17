/** Stub Fase 5 — profundidad mínima por zona. */
export type ZoneType = 'pedestrian' | 'vehicle' | 'road_crossing' | 'railway'

const DEPTH_CM: Record<ZoneType, number> = {
  pedestrian: 30,
  vehicle: 60,
  road_crossing: 80,
  railway: 120,
}

export function minDepthCm(zone: ZoneType): number {
  return DEPTH_CM[zone]
}

export function estimateAccessChambers(lengthM: number, turnsOver30: number): number {
  const byDistance = Math.ceil(lengthM / 30)
  return Math.max(2, byDistance + turnsOver30)
}
