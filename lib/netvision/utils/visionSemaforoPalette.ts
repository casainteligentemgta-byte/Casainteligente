import type { VisionBand } from '@/lib/netvision/types'

/**
 * Paleta neón del semáforo CCTV (verde / naranja / rojo).
 * El relleno usa solo la opacidad de la capa (`visionOpacity`, 36 % por
 * defecto). Las bandas son anillos que no se solapan: si se apilan,
 * Konva multiplica el alpha por polígono y el color se ensucia.
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

export const VISION_SEMAFORO_LEGEND: { band: VisionBand; label: string; hex: string }[] = [
  { band: 'green', label: 'Verde', hex: VISION_SEMAFORO_HEX.green },
  { band: 'yellow', label: 'Naranja', hex: VISION_SEMAFORO_HEX.yellow },
  { band: 'red', label: 'Rojo', hex: VISION_SEMAFORO_HEX.red },
]

export function visionBandSolidFill(band: VisionBand, alpha = 0.36): string {
  const a = Math.min(1, Math.max(0.08, alpha))
  const [r, g, b] = VISION_SEMAFORO_RGB[band]
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
