import type { VisionBand } from '@/lib/netvision/types'

/**
 * Paleta neón del semáforo CCTV (verde / naranja / rojo).
 * El relleno va casi opaco: la transparencia la aplica solo la capa
 * (`visionOpacity`, 36 % por defecto) para que el plano se vea debajo
 * sin ensuciar el color (relleno × capa ≈ 11 % y se veía grisáceo).
 */
export const VISION_SEMAFORO_RGB: Record<VisionBand, readonly [number, number, number]> = {
  green: [0, 255, 65],
  yellow: [255, 140, 0],
  red: [255, 32, 32],
}

export const VISION_SEMAFORO_HEX: Record<VisionBand, string> = {
  green: '#00FF41',
  yellow: '#FF8C00',
  red: '#FF2020',
}

/** Alpha del polígono; debe quedar alto para que no se mezclen las bandas. */
export const VISION_SEMAFORO_FILL_ALPHA: Record<VisionBand, number> = {
  green: 0.92,
  yellow: 0.9,
  red: 0.88,
}

export const VISION_SEMAFORO_LEGEND: { band: VisionBand; label: string; hex: string }[] = [
  { band: 'green', label: 'Verde', hex: VISION_SEMAFORO_HEX.green },
  { band: 'yellow', label: 'Naranja', hex: VISION_SEMAFORO_HEX.yellow },
  { band: 'red', label: 'Rojo', hex: VISION_SEMAFORO_HEX.red },
]

export function visionBandSolidFill(band: VisionBand): string {
  const [r, g, b] = VISION_SEMAFORO_RGB[band]
  return `rgba(${r}, ${g}, ${b}, ${VISION_SEMAFORO_FILL_ALPHA[band]})`
}
