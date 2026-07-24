'use client'

import { useMemo } from 'react'
import { Button } from '@/components/nexus/ui/button'
import { Mono } from '@/components/nexus/Mono'
import type { CableRoute, NetVisionProject } from '@/lib/netvision/types'
import {
  buildBimPackage,
  downloadBimPackageZipLike,
} from '@/lib/netvision/services/bimExporter'

type Props = {
  project: NetVisionProject
  cableRoutes: CableRoute[]
}

export default function BIMViewer({ project, cableRoutes }: Props) {
  const pkg = useMemo(
    () => buildBimPackage(project, cableRoutes),
    [project, cableRoutes],
  )

  const byPhase = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of pkg.elements) {
      map[e.bimPhase] = (map[e.bimPhase] ?? 0) + 1
    }
    return map
  }, [pkg.elements])

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          BIM / Revit
        </h2>
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Paquete IFC-lite + parámetros + Dynamo (no .RVT nativo en browser)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="Elementos" value={String(pkg.elements.length)} />
        <Stat label="Cables" value={String(pkg.cables.length)} />
        <Stat label="Equipment" value={String(byPhase.equipment ?? 0)} />
        <Stat label="Cabling" value={String(byPhase.cabling ?? 0)} />
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px] text-[var(--nexus-text-dim)]">
        <p className="font-semibold text-[var(--nexus-text-muted)]">Fases Revit</p>
        <ul className="mt-1 space-y-0.5">
          <li>1 Diseño — geometría sitio</li>
          <li>2 Cableado — conductos / cables</li>
          <li>3 Equipamiento — cámaras / switches / APs</li>
          <li>4 Documentación — etiquetas</li>
        </ul>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px] text-[var(--nexus-text-dim)]">
        <p className="font-semibold text-[var(--nexus-text-muted)]">Vistas generadas</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          {pkg.views.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </div>

      <ul className="max-h-36 space-y-1 overflow-auto text-[11px]">
        {pkg.elements
          .filter((e) => e.bimPhase !== 'documentation')
          .slice(0, 40)
          .map((e) => (
            <li
              key={e.globalId}
              className="rounded border border-white/10 bg-black/20 px-2 py-1"
            >
              <span className="font-semibold text-white">{e.label}</span>
              <span className="mt-0.5 block truncate text-[var(--nexus-text-dim)]">
                {e.type} · {e.bimPhase}
              </span>
            </li>
          ))}
      </ul>

      <Button
        type="button"
        variant="glass"
        className="w-full text-[11px]"
        disabled={pkg.elements.length === 0}
        onClick={() => downloadBimPackageZipLike(pkg)}
      >
        Exportar paquete BIM (JSON + CSV + Dynamo + IFC-lite)
      </Button>

      <p className="text-[10px] text-[var(--nexus-text-dim)]">
        {pkg.note}
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
      <p className="text-[10px] uppercase text-[var(--nexus-text-dim)]">{label}</p>
      <p className="font-semibold text-white">
        <Mono>{value}</Mono>
      </p>
    </div>
  )
}
