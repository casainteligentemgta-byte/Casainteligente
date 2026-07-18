'use client'

import { useMemo } from 'react'
import { Mono } from '@/components/nexus/Mono'
import {
  buildCrossSectionSvg,
  type ChamberMaterial,
  type TerrainType,
  type UndergroundPlan,
  type ZoneType,
  zoneLabel,
} from '@/lib/netvision/services/canalizationCalculator'

type Props = {
  plan: UndergroundPlan
  zone: ZoneType
  terrain: TerrainType
  chamberMaterial: ChamberMaterial
  onZone: (z: ZoneType) => void
  onTerrain: (t: TerrainType) => void
  onChamberMaterial: (m: ChamberMaterial) => void
}

const ZONES: ZoneType[] = ['pedestrian', 'vehicle', 'road_crossing', 'railway']
const TERRAINS: { id: TerrainType; label: string }[] = [
  { id: 'soft', label: 'Blando' },
  { id: 'medium', label: 'Medio' },
  { id: 'rocky', label: 'Rocoso' },
]
const MATERIALS: { id: ChamberMaterial; label: string }[] = [
  { id: 'polietileno', label: 'PE' },
  { id: 'hormigón', label: 'Hormigón' },
  { id: 'fibra_vidrio', label: 'Fibra' },
]

export default function UndergroundCanalizationTool({
  plan,
  zone,
  terrain,
  chamberMaterial,
  onZone,
  onTerrain,
  onChamberMaterial,
}: Props) {
  const sectionSvg = useMemo(() => {
    const pipeMm = plan.runs[0]?.pipe.innerMm ?? 110
    const depth = plan.runs[0]?.depthCm ?? 60
    return buildCrossSectionSvg(depth, pipeMm, zone)
  }, [plan.runs, zone])

  const ex = plan.excavation

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          Subterráneo
        </h2>
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Profundidad, tubería, cámaras de acceso y excavación
        </p>
      </div>

      <label className="block text-[11px] text-[var(--nexus-text-dim)]">
        Zona
        <select
          value={zone}
          onChange={(e) => onZone(e.target.value as ZoneType)}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
        >
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {zoneLabel(z)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[11px] text-[var(--nexus-text-dim)]">
        Terreno
        <select
          value={terrain}
          onChange={(e) => onTerrain(e.target.value as TerrainType)}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
        >
          {TERRAINS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[11px] text-[var(--nexus-text-dim)]">
        Material cámaras (Ø≥60 cm)
        <select
          value={chamberMaterial}
          onChange={(e) => onChamberMaterial(e.target.value as ChamberMaterial)}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
        >
          {MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="Tubería" value={`${plan.totalPipeM} m`} />
        <Stat label="Cámaras" value={String(plan.totalChambers)} />
        <Stat label="Excavación" value={`${ex.volumeM3} m³`} />
        <Stat label="Horas" value={String(ex.hours)} />
      </div>

      {plan.runs.length === 0 ? (
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Genera rutas de cable ≥ 8 m para tramos subterráneos.
        </p>
      ) : (
        <ul className="max-h-36 space-y-1 overflow-auto text-[11px]">
          {plan.runs.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5"
            >
              <span className="font-semibold text-white">
                {r.fromLabel} → {r.toLabel}
              </span>
              <span className="mt-0.5 block text-[var(--nexus-text-dim)]">
                <Mono>{r.lengthM} m</Mono> · {r.depthCm} cm · {r.pipe.label} ·{' '}
                {r.chambers.length} pozos · {r.cableCount} cables
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-hidden rounded-lg border border-white/10">
        <div dangerouslySetInnerHTML={{ __html: sectionSvg }} />
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px] text-[var(--nexus-text-dim)]">
        <p className="font-semibold text-[var(--nexus-text-muted)]">Excavación</p>
        <p className="mt-1">
          Zanja {ex.widthM}×{ex.depthM} m · {ex.needsShoring ? 'Con apuntalamiento' : 'Sin apuntalamiento'} · $
          {ex.costUsd.toFixed(0)}
        </p>
        <p className="mt-1">Equipos: {ex.equipment.join(', ')}</p>
        <p className="mt-1">Permisos: {ex.permits.join('; ')}</p>
      </div>
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
