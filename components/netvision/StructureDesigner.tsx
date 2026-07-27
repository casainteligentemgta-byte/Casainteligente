'use client'

import {
  DEFAULT_STRUCTURE_MATERIAL_ID,
  STRUCTURE_MATERIALS,
  getStructureMaterialOrDefault,
} from '@/lib/netvision/catalog/materials'
import type { DesignStructure, StructureMaterialId } from '@/lib/netvision/types'
import NetVisionCollapsible from '@/components/netvision/NetVisionCollapsible'

type Props = {
  structures: DesignStructure[]
  drawMaterialId: StructureMaterialId | null
  draftPoint: { x: number; y: number } | null
  disabled?: boolean
  /** Capa visible en el plano */
  showOnPlan?: boolean
  onShowOnPlan?: (visible: boolean) => void
  onDrawMaterial: (id: StructureMaterialId | null) => void
  /** Termina la polilínea actual (deja de continuar desde la esquina). */
  onFinishDraft?: () => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export default function StructureDesigner({
  structures,
  drawMaterialId,
  draftPoint,
  disabled = false,
  showOnPlan = true,
  onShowOnPlan,
  onDrawMaterial,
  onFinishDraft,
  onSelect,
  onRemove,
}: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          Muros · vidrio · puertas
        </h2>
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Toca puntos en el plano: cada tramo se ajusta a 90° (H/V) y puedes seguir desde la
          esquina. Pulsa «Terminar» al cerrar el muro. Arrastra el segmento o los extremos para
          mover.
        </p>
      </div>

      {onShowOnPlan ? (
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[11px]">
          <span className="text-[var(--nexus-text-muted)]">
            {showOnPlan ? 'Estructuras visibles en el plano' : 'Estructuras ocultas en el plano'}
          </span>
          <input
            type="checkbox"
            checked={showOnPlan}
            onChange={(e) => onShowOnPlan(e.target.checked)}
            className="accent-[var(--nexus-cyan)]"
          />
        </label>
      ) : null}

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
        <div className="space-y-1.5">
          <p className="rounded-lg border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.08)] px-2 py-1.5 text-[11px] text-[var(--nexus-cyan)]">
            {draftPoint
              ? `Siguiente esquina (${getStructureMaterialOrDefault(drawMaterialId).label}) — tramo a 90°.`
              : `Toca el primer punto (${getStructureMaterialOrDefault(drawMaterialId).label}).`}
          </p>
          {draftPoint && onFinishDraft ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onFinishDraft}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10 disabled:opacity-40"
            >
              Terminar muro
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[10px] text-[var(--nexus-text-dim)]">
          Elige un material y traza el muro por puntos (esquinas a 90°).
        </p>
      )}

      <NetVisionCollapsible
        title={`Estructuras (${structures.length})`}
        summary={
          structures.length === 0
            ? 'Sin segmentos'
            : structures
                .slice(0, 3)
                .map((s) => s.label)
                .join(' · ') + (structures.length > 3 ? '…' : '')
        }
        defaultOpen={structures.length > 0 && structures.length <= 8}
      >
        {structures.length === 0 ? (
          <p className="text-[11px] text-[var(--nexus-text-dim)]">
            Sin segmentos aún. Ejemplo: drywall, bloque, concreto, vidrio, ventana, puerta.
          </p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-auto text-[11px]">
            {structures.map((s) => {
              const mat = getStructureMaterialOrDefault(s.materialId)
              const visionNote = mat.blocksVision
                ? ' · corta visión'
                : mat.id === 'door'
                  ? ' · abertura'
                  : ' · transparente'
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
                    <span
                      className="mt-0.5 block truncate"
                      style={{ color: mat.color }}
                    >
                      {mat.label}
                      {visionNote}
                      {' · arrastrable'}
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
      </NetVisionCollapsible>

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
