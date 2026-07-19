'use client'

import {
  DEFAULT_STRUCTURE_MATERIAL_ID,
  STRUCTURE_MATERIALS,
  getStructureMaterialOrDefault,
} from '@/lib/netvision/catalog/materials'
import type { DesignStructure, StructureMaterialId } from '@/lib/netvision/types'

type Props = {
  structures: DesignStructure[]
  drawMaterialId: StructureMaterialId | null
  draftPoint: { x: number; y: number } | null
  disabled?: boolean
  onDrawMaterial: (id: StructureMaterialId | null) => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export default function StructureDesigner({
  structures,
  drawMaterialId,
  draftPoint,
  disabled = false,
  onDrawMaterial,
  onSelect,
  onRemove,
}: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
        Muros · visión / WiFi / sonido
      </h2>
      <p className="text-[11px] text-[var(--nexus-text-dim)]">
        Dibuja segmentos en el plano (2 toques). Luego arrastra el muro o sus
        extremos para moverlo. Drywall y bloque cortan el FOV; vidrio y ventana
        dejan ver pero atenúan WiFi y sonido.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {STRUCTURE_MATERIALS.map((m) => {
          const active = drawMaterialId === m.id
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => onDrawMaterial(active ? null : m.id)}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-40 ${
                active
                  ? 'bg-[var(--nexus-cyan)] text-black'
                  : 'border border-white/15 text-[var(--nexus-text-muted)]'
              }`}
              style={!active ? { borderColor: `${m.color}66`, color: m.color } : undefined}
            >
              + {m.label}
            </button>
          )
        })}
      </div>

      {drawMaterialId ? (
        <p className="rounded-lg border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.08)] px-2 py-1.5 text-[11px] text-[var(--nexus-cyan)]">
          {draftPoint
            ? `Toca el segundo punto (${getStructureMaterialOrDefault(drawMaterialId).label}).`
            : `Toca el primer punto en el plano (${getStructureMaterialOrDefault(drawMaterialId).label}).`}
        </p>
      ) : (
        <p className="text-[10px] text-[var(--nexus-text-dim)]">
          Elige un material y marca 2 puntos en el plano.
        </p>
      )}

      <div>
        <h3 className="mb-1 text-[10px] font-bold uppercase text-[var(--nexus-text-dim)]">
          Estructuras ({structures.length})
        </h3>
        {structures.length === 0 ? (
          <p className="text-[11px] text-[var(--nexus-text-dim)]">
            Sin muros aún. Ejemplo: drywall, bloque, vidrio, ventana.
          </p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-auto text-[11px]">
            {structures.map((s) => {
              const mat = getStructureMaterialOrDefault(s.materialId)
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded border border-white/10 bg-black/20 px-2 py-1"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelect(s.id)}
                  >
                    <span className="font-semibold text-white">{s.label}</span>
                    <span className="mt-0.5 block truncate" style={{ color: mat.color }}>
                      {mat.label}
                      {mat.blocksVision ? ' · corta visión' : ' · transparente'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="text-[10px] text-red-300"
                    onClick={() => onRemove(s.id)}
                  >
                    Quitar
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!drawMaterialId && structures.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          className="w-full rounded-lg border border-white/15 px-2 py-1.5 text-[11px] text-[var(--nexus-text-muted)] disabled:opacity-40"
          onClick={() => onDrawMaterial(DEFAULT_STRUCTURE_MATERIAL_ID)}
        >
          Empezar con drywall
        </button>
      ) : null}
    </div>
  )
}
