import normatives from '@/data/netvision/normatives.json'
import countries from '@/data/netvision/countries.json'
import type { ConduitPlan } from '@/lib/netvision/services/conduitCalculator'
import type {
  CableRoute,
  Conduit,
  DesignCamera,
  DesignNetworkNode,
  ProjectDesign,
  ValidationResult,
} from '@/lib/netvision/types'

type OccupancyResult = {
  error: boolean
  occupancy: number
  message?: string
}

export type ComplianceReport = {
  countryCode: string
  profiles: string[]
  generatedAt: string
  results: ValidationResult[]
  matrix: { code: string; profile: string; level: string; message: string; solution: string }[]
  summary: { errors: number; warnings: number; infos: number }
}

/** Convierte rutas NetVision al ProjectDesign del validador. */
export function designFromRoutes(
  cameras: DesignCamera[],
  routes: CableRoute[],
  networkNodes: DesignNetworkNode[] = [],
): ProjectDesign {
  return {
    cameras,
    cables: routes.map((r) => ({
      id: r.id,
      type: r.type,
      length: r.routeM,
      certified: r.certified,
      fromId: r.fromId,
      toId: r.toId,
    })),
    powerElements: networkNodes
      .filter((n) => n.kind === 'switch' || n.kind === 'nvr')
      .map((n) => ({ id: n.id, x: n.x, y: n.y })),
  }
}

export function profilesForCountry(countryCode: string): string[] {
  const entry = (countries as Record<string, { profiles: string[] }>)[countryCode]
  return entry?.profiles ?? ['IEC', 'TIA_EIA_568']
}

export function listCountries(): { code: string; label: string; profiles: string[] }[] {
  return Object.entries(countries as Record<string, { label: string; profiles: string[] }>).map(
    ([code, v]) => ({ code, label: v.label, profiles: v.profiles }),
  )
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
          message: `Cable ${cable.id} supera ${nec.maxPoEDistance}m PoE sin repetidor`,
          solution: 'Cambiar a fibra o agregar repetidor/injector PoE midspan',
          cameraId: cable.fromId,
          nodeId: cable.toId,
        })
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

    if (design.cables.length > 0 && design.powerElements.length > 0) {
      results.push({
        level: 'INFO',
        code: 'NEC-002',
        message: `Verificar separación ≥${nec.minSeparationHighVoltage} cm respecto a alto voltaje`,
        solution: 'Mantener distancia a líneas de potencia / SPD en racks',
      })
      results.push({
        level: 'INFO',
        code: 'NEC-004',
        message: `Grounding en ducto metálico cada ${nec.groundingInterval} m`,
        solution: 'Documentar puntos de puesta a tierra en el plano',
      })
    }

    return results
  }

  validateIEC(design: ProjectDesign): ValidationResult[] {
    const iec = normatives.IEC
    const results: ValidationResult[] = []
    for (const cable of design.cables) {
      if (cable.type === 'COAX') {
        results.push({
          level: 'INFO',
          code: 'IEC-001',
          message: `Coaxial ${cable.id}: impedancia objetivo ${iec.coaxialImpedance}`,
          solution: 'Usar coax 75Ω certificado para video',
        })
      }
      if (cable.length > 0) {
        results.push({
          level: 'INFO',
          code: 'IEC-002',
          message: `Separación a potencia ≥${iec.minSeparationPower} cm (IEC)`,
          solution: 'Separar bandejas de datos y potencia',
          nodeId: cable.toId,
        })
        break // una sola vez por diseño
      }
    }
    if (design.cables.some((c) => c.type === 'CAT6' || c.type === 'CAT6A')) {
      results.push({
        level: 'INFO',
        code: 'IEC-003',
        message: `Crosstalk máx ${iec.maxCrosstalk} dB · Return loss ${iec.returnLoss} dB @100MHz`,
        solution: 'Certificar enlaces tras instalación',
      })
    }
    return results
  }

  validateNFPA(design: ProjectDesign): ValidationResult[] {
    const nfpa = normatives.NFPA
    const results: ValidationResult[] = []
    if (design.cables.length === 0) return results
    if (nfpa.requireLSZH) {
      results.push({
        level: 'WARNING',
        code: 'NFPA-001',
        message: 'Se requiere cable LSZH (Low Smoke Zero Halogen) en áreas ocupadas',
        solution: 'Especificar jacket LSZH / plenum según local',
      })
    }
    results.push({
      level: 'INFO',
      code: 'NFPA-002',
      message: `Distancia a fuentes de calor ≥${nfpa.minDistanceHeatSource} cm · fire rating ${nfpa.fireRating}`,
      solution: 'Alejar de transformadores / calefacción; conductos retardantes en riesgo',
    })
    return results
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
          cameraId: cable.fromId,
          nodeId: cable.toId,
        })
      } else if (
        (cable.type === 'CAT5E' || cable.type === 'CAT6' || cable.type === 'CAT6A') &&
        cable.length > tia.maxWorkZoneDistance
      ) {
        results.push({
          level: 'WARNING',
          code: 'TIA-002',
          message: `Cable ${cable.id}: ${cable.length}m supera zona de trabajo ${tia.maxWorkZoneDistance}m`,
          solution: 'Revisar patch + horizontal ≤100m total',
          cameraId: cable.fromId,
        })
      }
    }
    results.push({
      level: 'INFO',
      code: 'TIA-003',
      message: `Radio curvatura ≥${tia.radiusCurvature}×Ø · tensión ≤${tia.maxCableTension} lb · ocupación ≤${tia.maxConduitOccupancy * 100}%`,
      solution: 'Aplicar en instalación y cajetines',
    })
    return results
  }

  validateISO27001(design: ProjectDesign): ValidationResult[] {
    const iso = normatives.ISO27001
    const results: ValidationResult[] = []
    if (iso.requireAuditLog) {
      results.push({
        level: 'INFO',
        code: 'ISO-001',
        message: 'Se requiere log de cambios de configuración del diseño',
        solution: 'Exportar JSON con timestamp y versionar el proyecto',
      })
    }
    if (iso.segregateNetworks && design.cameras.length > 0) {
      results.push({
        level: 'WARNING',
        code: 'ISO-002',
        message: 'Segregar físicamente / VLAN la red de cámaras de la red corporativa',
        solution: 'Usar switch/VLAN dedicada CCTV',
      })
    }
    if (iso.restrictedAccess) {
      results.push({
        level: 'INFO',
        code: 'ISO-003',
        message: 'Acceso restringido a racks, NVRs y puntos de conexión',
        solution: 'Documentar control de acceso físico',
      })
    }
    if (iso.requireEncryption) {
      results.push({
        level: 'INFO',
        code: 'ISO-004',
        message: 'Cifrado en tránsito (TLS/HTTPS) para datos sensibles de video/gestión',
        solution: 'Habilitar HTTPS en NVR/VMS y VPN de sitio',
      })
    }
    return results
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

  validateConduitPlans(plans: ConduitPlan[]): ValidationResult[] {
    const maxOcc = normatives.TIA_EIA_568.maxConduitOccupancy
    const results: ValidationResult[] = []
    for (const p of plans) {
      if (!p.ok || p.occupancy > 1) {
        results.push({
          level: 'ERROR',
          code: 'TIA-OCC-001',
          message: `${p.nodeLabel}: ocupación conducto/cajetín ${(p.occupancy * 100).toFixed(0)}% (máx ${maxOcc * 100}% diseño)`,
          solution: 'Aumentar Ø o dividir cables',
          nodeId: p.nodeId,
        })
      }
    }
    return results
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

  buildReport(
    countryCode: string,
    design: ProjectDesign,
    conduitPlans: ConduitPlan[] = [],
  ): ComplianceReport {
    const profiles = profilesForCountry(countryCode)
    const results = [
      ...this.validateAll(design, profiles),
      ...this.validateConduitPlans(conduitPlans),
    ]
    // Deduplicar por code+message
    const seen = new Set<string>()
    const unique = results.filter((r) => {
      const k = `${r.code}|${r.message}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    const matrix = unique.map((r) => ({
      code: r.code,
      profile: r.code.split('-')[0] ?? 'GEN',
      level: r.level,
      message: r.message,
      solution: r.solution,
    }))
    return {
      countryCode,
      profiles,
      generatedAt: new Date().toISOString(),
      results: unique,
      matrix,
      summary: {
        errors: unique.filter((r) => r.level === 'ERROR').length,
        warnings: unique.filter((r) => r.level === 'WARNING').length,
        infos: unique.filter((r) => r.level === 'INFO').length,
      },
    }
  }
}

export const complianceValidator = new ComplianceValidator()

export function complianceMatrixCsv(report: ComplianceReport): string {
  const header = 'code,profile,level,message,solution'
  const rows = report.matrix.map(
    (m) =>
      `${csv(m.code)},${csv(m.profile)},${csv(m.level)},${csv(m.message)},${csv(m.solution)}`,
  )
  return [header, ...rows].join('\n')
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function openCompliancePrintable(report: ComplianceReport) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!w) return
  const rows = report.matrix
    .map(
      (m) =>
        `<tr><td>${esc(m.code)}</td><td>${esc(m.level)}</td><td>${esc(m.message)}</td><td>${esc(m.solution)}</td></tr>`,
    )
    .join('')
  w.document.write(`<!doctype html><html><head><title>NetVision — Cumplimiento</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#111}
h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}
td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}
.meta{color:#444;font-size:13px}
</style></head><body>
<h1>NetVision Pro — Reporte de cumplimiento</h1>
<p class="meta">País/perfil: ${esc(report.countryCode)} · Normas: ${esc(report.profiles.join(', '))}</p>
<p class="meta">Errores: ${report.summary.errors} · Advertencias: ${report.summary.warnings} · Info: ${report.summary.infos}</p>
<p class="meta">Generado: ${esc(report.generatedAt)}</p>
<table><thead><tr><th>Código</th><th>Nivel</th><th>Mensaje</th><th>Solución</th></tr></thead>
<tbody>${rows}</tbody></table>
<p class="meta">Documento de asistencia de ingeniería — no sustituye certificación oficial.</p>
<script>window.onload=()=>window.print()</script>
</body></html>`)
  w.document.close()
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
