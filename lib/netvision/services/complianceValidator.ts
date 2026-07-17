import normatives from '@/data/netvision/normatives.json'
import type {
  Conduit,
  ProjectDesign,
  ValidationResult,
} from '@/lib/netvision/types'

type OccupancyResult = {
  error: boolean
  occupancy: number
  message?: string
}

/** Validador normativo (Fase 6). Umbrales desde normatives.json. */
export class ComplianceValidator {
  validateNEC(design: ProjectDesign): ValidationResult[] {
    const nec = normatives.NEC
    const results: ValidationResult[] = []

    for (const cable of design.cables) {
      if (
        (cable.type === 'CAT5E' || cable.type === 'CAT6' || cable.type === 'CAT6A') &&
        cable.length > nec.maxPoEDistance
      ) {
        results.push({
          level: 'ERROR',
          code: 'NEC-001',
          message: `Cable ${cable.id} supera ${nec.maxPoEDistance}m sin repetidor`,
          solution: 'Cambiar a fibra o agregar repetidor/injector PoE midspan',
        })
      }

      // Fase 4: distancia real cable↔power. Aquí solo si coords coinciden como puntos.
      for (const p of design.powerElements) {
        const dx = p.x
        const dy = p.y
        // Placeholder geométrico: si el diseño aún no tiene path de cable, no emitir NEC-002
        void dx
        void dy
      }

      if (!cable.certified) {
        results.push({
          level: 'ERROR',
          code: 'NEC-003',
          message: `Cable ${cable.id} no es ${nec.requiredCertification} Listed`,
          solution: `Cambiar a cable certificado ${nec.requiredCertification}`,
        })
      }
    }

    return results
  }

  validateIEC(_design: ProjectDesign): ValidationResult[] {
    return []
  }

  validateNFPA(_design: ProjectDesign): ValidationResult[] {
    return []
  }

  validateTIA_EIA(design: ProjectDesign): ValidationResult[] {
    const tia = normatives.TIA_EIA_568
    const results: ValidationResult[] = []
    for (const cable of design.cables) {
      if (
        (cable.type === 'CAT5E' || cable.type === 'CAT6' || cable.type === 'CAT6A') &&
        cable.length > tia.maxHorizontalDistance
      ) {
        results.push({
          level: 'ERROR',
          code: 'TIA-001',
          message: `Cable ${cable.id} supera ${tia.maxHorizontalDistance}m horizontal TIA/EIA 568`,
          solution: 'Acortar tramo o usar fibra óptica',
        })
      }
    }
    return results
  }

  validateISO27001(_design: ProjectDesign): ValidationResult[] {
    const iso = normatives.ISO27001
    if (!iso.requireAuditLog) return []
    return [
      {
        level: 'INFO',
        code: 'ISO-001',
        message: 'Se requiere log de cambios de configuración del diseño',
        solution: 'Activar historial de proyecto (Fase 6 / Supabase)',
      },
    ]
  }

  validateConduitOccupancy(conduit: Conduit): OccupancyResult {
    const maxOcc = normatives.TIA_EIA_568.maxConduitOccupancy
    const totalArea = conduit.cables.reduce((sum, c) => sum + c.area, 0)
    const occupancy = conduit.area > 0 ? totalArea / conduit.area : 0
    if (occupancy > maxOcc) {
      return {
        error: true,
        occupancy,
        message: `Excede ${(maxOcc * 100).toFixed(0)}% de ocupación`,
      }
    }
    return { error: false, occupancy }
  }

  validateAll(design: ProjectDesign, profileIds: string[]): ValidationResult[] {
    const out: ValidationResult[] = []
    const set = new Set(profileIds)
    if (set.has('NEC')) out.push(...this.validateNEC(design))
    if (set.has('IEC')) out.push(...this.validateIEC(design))
    if (set.has('NFPA')) out.push(...this.validateNFPA(design))
    if (set.has('TIA_EIA_568')) out.push(...this.validateTIA_EIA(design))
    if (set.has('ISO27001')) out.push(...this.validateISO27001(design))
    return out
  }
}

export const complianceValidator = new ComplianceValidator()
