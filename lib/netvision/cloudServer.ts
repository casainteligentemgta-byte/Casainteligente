import type { NetVisionProject } from '@/lib/netvision/types'
import { projectFromPartial } from '@/lib/netvision/storage'

export type NetVisionProjectRow = {
  user_id: string
  id: string
  name: string
  description: string
  client_name: string
  unit_system: string
  currency: string
  distributor_margin_pct: number
  compliance_profile_id: string
  retention_days: number
  plano_nombre: string
  has_plano: boolean
  payload: unknown
  created_at: string
  updated_at: string
}

export function rowToProject(row: NetVisionProjectRow): NetVisionProject {
  const payload =
    row.payload && typeof row.payload === 'object'
      ? (row.payload as Partial<NetVisionProject>)
      : {}
  return projectFromPartial(
    {
      ...payload,
      id: row.id,
      name: row.name || payload.name,
      description: row.description ?? payload.description,
      client: row.client_name ?? payload.client,
      unitSystem: (row.unit_system as NetVisionProject['unitSystem']) || payload.unitSystem,
      currency: (row.currency as NetVisionProject['currency']) || payload.currency,
      distributorMarginPct: Number(row.distributor_margin_pct),
      complianceProfileId: row.compliance_profile_id || payload.complianceProfileId,
      retentionDays: row.retention_days || payload.retentionDays,
      planoNombre: row.plano_nombre || payload.planoNombre,
      updatedAt: row.updated_at || payload.updatedAt,
    },
    row.id,
  )
}

export function projectToRowFields(project: NetVisionProject) {
  const hasPlano = Boolean(project.planoUrl && project.planoUrl.length > 0)
  return {
    id: project.id,
    name: project.name.slice(0, 200),
    description: (project.description ?? '').slice(0, 4000),
    client_name: (project.client ?? '').slice(0, 200),
    unit_system: project.unitSystem,
    currency: project.currency,
    distributor_margin_pct: project.distributorMarginPct,
    compliance_profile_id: project.complianceProfileId,
    retention_days: project.retentionDays,
    plano_nombre: (project.planoNombre ?? '').slice(0, 500),
    has_plano: hasPlano,
    payload: project,
    updated_at: project.updatedAt || new Date().toISOString(),
  }
}
