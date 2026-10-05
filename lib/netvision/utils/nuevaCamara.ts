import type { DesignCamera } from '@/lib/netvision/types'

export type PlantillaNuevaCamara = {
  modelId: string
  conexion?: DesignCamera['conexion']
}

type CamaraFuente = Pick<DesignCamera, 'id' | 'modelId' | 'conexion'>

/**
 * Modelo y conexión de la próxima cámara que se coloca.
 *
 * - Si hay una cámara elegida, se copia esa (mismo tipo que se está editando).
 * - Si no, se usa `defaultModelId` (el «Tipo de cámara» de la barra).
 * - Si ese tipo coincide con la última cámara del plano, se copia también
 *   si iba por Wi‑Fi o por cable a propósito.
 *
 * Así, al recargar el iPad, las nuevas no vuelven al Hikvision del catálogo
 * si el proyecto ya tiene Ezviz (el editor siembra `defaultModelId` con la última).
 */
export function plantillaNuevaCamara(
  cameras: readonly CamaraFuente[],
  selectedId: string | null,
  defaultModelId: string,
): PlantillaNuevaCamara {
  const selected = selectedId ? cameras.find((c) => c.id === selectedId) : undefined
  if (selected) {
    return {
      modelId: selected.modelId,
      ...(selected.conexion ? { conexion: selected.conexion } : {}),
    }
  }
  const ultima = cameras[cameras.length - 1]
  if (!ultima) return { modelId: defaultModelId }
  if (ultima.modelId !== defaultModelId) return { modelId: defaultModelId }
  return {
    modelId: defaultModelId,
    ...(ultima.conexion ? { conexion: ultima.conexion } : {}),
  }
}

/** Modelo con el que sembrar el selector al abrir un proyecto. */
export function modeloPorDefectoDelProyecto(
  cameras: readonly Pick<DesignCamera, 'modelId'>[],
  fallback: string,
): string {
  const ultima = cameras[cameras.length - 1]
  return ultima?.modelId || fallback
}
