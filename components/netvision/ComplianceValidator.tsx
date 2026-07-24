'use client'

import { useMemo } from 'react'
import { Button } from '@/components/nexus/ui/button'
import { Mono } from '@/components/nexus/Mono'
import ValidationEngine from '@/components/netvision/ValidationEngine'
import type { ConduitPlan } from '@/lib/netvision/services/conduitCalculator'
import type { CableRoute, DesignCamera, DesignNetworkNode } from '@/lib/netvision/types'
import {
  complianceMatrixCsv,
  complianceValidator,
  designFromRoutes,
  listCountries,
  openCompliancePrintable,
  profilesForCountry,
} from '@/lib/netvision/services/complianceValidator'
import { downloadCsv } from '@/lib/netvision/utils/exporters'

type Props = {
  countryCode: string
  onCountry: (code: string) => void
  cameras: DesignCamera[]
  networkNodes: DesignNetworkNode[]
  cableRoutes: CableRoute[]
  conduitPlans: ConduitPlan[]
  onSelect?: (id: string) => void
}

export default function ComplianceValidatorPanel({
  countryCode,
  onCountry,
  cameras,
  networkNodes,
  cableRoutes,
  conduitPlans,
  onSelect,
}: Props) {
  const countries = useMemo(() => listCountries(), [])
  const profiles = useMemo(() => profilesForCountry(countryCode), [countryCode])

  const report = useMemo(() => {
    const design = designFromRoutes(cameras, cableRoutes, networkNodes)
    return complianceValidator.buildReport(countryCode, design, conduitPlans)
  }, [cameras, cableRoutes, networkNodes, conduitPlans, countryCode])

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          Normativas
        </h2>
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Validación en tiempo real · NEC / IEC / NFPA / TIA / ISO27001
        </p>
      </div>

      <label className="block text-[11px] text-[var(--nexus-text-dim)]">
        País / región
        <select
          value={countryCode}
          onChange={(e) => onCountry(e.target.value)}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} ({c.code})
            </option>
          ))}
        </select>
      </label>

      <p className="text-[11px] text-[var(--nexus-text-dim)]">
        Perfiles activos:{' '}
        <Mono className="text-[var(--nexus-cyan)]">{profiles.join(', ')}</Mono>
      </p>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="Errores" value={String(report.summary.errors)} danger={report.summary.errors > 0} />
        <Stat label="Warn" value={String(report.summary.warnings)} warn={report.summary.warnings > 0} />
        <Stat label="Info" value={String(report.summary.infos)} />
      </div>

      <ValidationEngine results={report.results} onSelectCamera={onSelect} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="glass"
          className="text-[11px]"
          onClick={() =>
            downloadCsv(
              `netvision-compliance-${countryCode}.csv`,
              complianceMatrixCsv(report),
            )
          }
        >
          Matriz Excel/CSV
        </Button>
        <Button
          type="button"
          variant="glass"
          className="text-[11px]"
          onClick={() => openCompliancePrintable(report)}
        >
          PDF cumplimiento
        </Button>
      </div>

      <p className="text-[10px] text-[var(--nexus-text-dim)]">
        Asistencia de ingeniería — no sustituye certificación oficial ni firma digital PKI.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  danger,
  warn,
}: {
  label: string
  value: string
  danger?: boolean
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 ${
        danger
          ? 'border-red-500/40 bg-red-500/10'
          : warn
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-white/10 bg-black/30'
      }`}
    >
      <p className="text-[10px] uppercase text-[var(--nexus-text-dim)]">{label}</p>
      <p className="font-semibold text-white">
        <Mono>{value}</Mono>
      </p>
    </div>
  )
}
