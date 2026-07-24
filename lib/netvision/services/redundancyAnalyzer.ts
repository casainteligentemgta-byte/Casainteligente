import type { CoverageSector, DesignCamera, ValidationResult } from '@/lib/netvision/types'
import { distNorm, pointInSector } from '@/lib/netvision/utils/geometryHelpers'
import { estimateCoverageRatio } from '@/lib/netvision/services/coverageCalculator'

/** Detecta solapamiento fuerte (redundancia) y huecos de cobertura. */
export function analyzeRedundancy(
  cameras: DesignCamera[],
  sectors: CoverageSector[],
): ValidationResult[] {
  const results: ValidationResult[] = []

  for (let i = 0; i < cameras.length; i++) {
    for (let j = i + 1; j < cameras.length; j++) {
      const a = cameras[i]!
      const b = cameras[j]!
      const sa = sectors.find((s) => s.cameraId === a.id)
      const sb = sectors.find((s) => s.cameraId === b.id)
      if (!sa || !sb) continue

      const d = distNorm(a.x, a.y, b.x, b.y)
      const minR = Math.min(sa.radiusNorm, sb.radiusNorm)
      if (d < minR * 0.35) {
        results.push({
          level: 'WARNING',
          code: 'COV-RED-001',
          message: `${a.label} y ${b.label} están muy cerca (posible redundancia excesiva)`,
          solution: 'Separa las cámaras o reduce FOV/alcance de una de ellas',
          cameraId: a.id,
        })
      }

      // Centro de A dentro del sector de B
      if (
        pointInSector(a.x, a.y, sb.cx, sb.cy, sb.radiusNorm, sb.startAngleRad, sb.endAngleRad) &&
        pointInSector(b.x, b.y, sa.cx, sa.cy, sa.radiusNorm, sa.startAngleRad, sa.endAngleRad)
      ) {
        results.push({
          level: 'INFO',
          code: 'COV-RED-002',
          message: `${a.label} y ${b.label} se cubren mutuamente (buena redundancia)`,
          solution: 'Mantener si el área es crítica; documentar como zona redundante',
          cameraId: a.id,
        })
      }
    }
  }

  const { coveredRatio, uncoveredCells, totalCells } = estimateCoverageRatio(sectors)
  if (cameras.length > 0 && coveredRatio < 0.45) {
    results.push({
      level: 'WARNING',
      code: 'COV-BLIND-001',
      message: `Cobertura estimada ${(coveredRatio * 100).toFixed(0)}% (${uncoveredCells}/${totalCells} celdas sin FOV)`,
      solution: 'Agrega cámaras, amplía FOV o reorienta yaw hacia zonas descubiertas',
    })
  } else if (cameras.length > 0 && coveredRatio >= 0.75) {
    results.push({
      level: 'INFO',
      code: 'COV-OK-001',
      message: `Cobertura estimada ${(coveredRatio * 100).toFixed(0)}% del plano`,
      solution: 'Revisa puntos ciegos en esquinas y detrás de obstáculos reales',
    })
  }

  for (const cam of cameras) {
    if (cam.x < 0.02 || cam.x > 0.98 || cam.y < 0.02 || cam.y > 0.98) {
      results.push({
        level: 'WARNING',
        code: 'COV-EDGE-001',
        message: `${cam.label} está en el borde del plano`,
        solution: 'Verifica que el montaje real no quede fuera del área útil',
        cameraId: cam.id,
      })
    }
  }

  return results
}
