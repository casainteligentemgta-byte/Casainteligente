import { soundLossBetween } from '@/lib/netvision/services/structureAttenuation'
import type {
  DesignCamera,
  DesignStructure,
  ScaleCalibration,
  SpectrumCell,
} from '@/lib/netvision/types'
import { distMeters } from '@/lib/netvision/utils/geometryHelpers'

/**
 * Espectro de sonido simplificado: cada cámara actúa como micrófono
 * (cobertura omnidireccional ~8 m) atenuada por muros/vidrio.
 * Nivel relativo 0–1 para mapa de calor.
 */
export function buildSoundSpectrum(
  cameras: DesignCamera[],
  scale: ScaleCalibration,
  structures: DesignStructure[] = [],
  grid = 28,
  listenRangeM = 8,
  extraSources: { x: number; y: number; rangeM?: number }[] = [],
): SpectrumCell[] {
  const sources = [
    ...cameras.map((c) => ({ x: c.x, y: c.y, rangeM: listenRangeM })),
    ...extraSources.map((s) => ({
      x: s.x,
      y: s.y,
      rangeM: s.rangeM && s.rangeM > 0 ? s.rangeM : listenRangeM,
    })),
  ]
  if (sources.length === 0) return []

  const cell = 1 / grid
  const cells: SpectrumCell[] = []
  const refSpl = 60 // dB arbitario en origen
  const floorSpl = 25

  for (let iy = 0; iy < grid; iy++) {
    for (let ix = 0; ix < grid; ix++) {
      const px = (ix + 0.5) * cell
      const py = (iy + 0.5) * cell
      let best = -999
      for (const src of sources) {
        const d = distMeters(
          src.x,
          src.y,
          px,
          py,
          scale.metersPerNormX,
          scale.metersPerNormY,
        )
        if (d > src.rangeM * 1.4) continue
        // Caída ~6 dB por duplicar distancia + pérdidas de muro
        const distLoss = 20 * Math.log10(Math.max(1, d))
        const wallLoss = soundLossBetween(src.x, src.y, px, py, structures)
        const spl = refSpl - distLoss - wallLoss
        if (spl > best) best = spl
      }
      if (best < floorSpl) continue
      const strength = Math.min(
        1,
        Math.max(0, (best - floorSpl) / (refSpl - floorSpl)),
      )
      cells.push({
        x: ix * cell,
        y: iy * cell,
        w: cell,
        h: cell,
        strength,
      })
    }
  }
  return cells
}
