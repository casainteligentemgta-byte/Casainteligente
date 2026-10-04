import { clampGrosorMuro } from '@/lib/netvision/utils/nightPlanoPalette'

/** Bloque y concreto comparten trazo (mismo grosor y color de línea). */
export const WALL_MASONRY_COLOR = '#78716c'
export const WALL_MASONRY_INVERT = '#e7e5e4'
export const WALL_MASONRY_INVERT_SELECTED = '#f5f5f4'

export function isMasonryWall(materialId: string | undefined): boolean {
  return materialId === 'block' || materialId === 'concrete'
}

export function structureLineGrosor(s?: { grosor?: number } | null): number {
  return clampGrosorMuro(s?.grosor)
}

/**
 * Grosor en px del muro dibujado. Bloque y concreto usan la misma curva.
 * Seleccionado solo añade un resalte leve: el slider manda.
 */
export function wallDrawnStrokePx(grosor: number, selected = false): number {
  const t = 0.9 + (clampGrosorMuro(grosor) / 100) * 7.2
  return Math.round((selected ? t + 0.45 : t) * 100) / 100
}

export function wallStrokeColor(
  mat: { id: string; color: string },
  invert: boolean,
  selected: boolean,
): string {
  if (isMasonryWall(mat.id)) {
    if (invert) return selected ? WALL_MASONRY_INVERT_SELECTED : WALL_MASONRY_INVERT
    return selected ? '#a8a29e' : WALL_MASONRY_COLOR
  }
  return mat.color
}
