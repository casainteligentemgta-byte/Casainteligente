'use client'

import { Eye, EyeOff } from 'lucide-react'
import type { DesignCamera } from '@/lib/netvision/types'
import { isCameraCoverageVisible } from '@/lib/netvision/utils/cameraVisionVisibility'

export type NetVisionCameraVisionTogglesProps = {
  cameras: DesignCamera[]
  hiddenIds: readonly string[]
  onShowAll: () => void
  onSolo: (id: string) => void
  onToggle: (id: string) => void
  onSelect?: (id: string) => void
  compact?: boolean
  /** Oculta la pista de arrastrar nombres (vista cliente). */
  readOnlyHint?: boolean
}

export default function NetVisionCameraVisionToggles({
  cameras,
  hiddenIds,
  onShowAll,
  onSolo,
  onToggle,
  onSelect,
  compact = false,
  readOnlyHint = false,
}: NetVisionCameraVisionTogglesProps) {
  if (cameras.length === 0) return null
  const allOn = hiddenIds.length === 0

  return (
    <div className={compact ? 'min-w-0' : 'space-y-1.5'}>
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:thin]">
        <button
          type="button"
          title="Mostrar el semáforo de todas las cámaras"
          aria-pressed={allOn}
          onClick={onShowAll}
          className={`shrink-0 rounded-md px-2.5 text-[11px] font-semibold ${
            compact ? 'min-h-9' : 'min-h-8'
          } ${
            allOn
              ? 'bg-[var(--nexus-cyan)] text-black'
              : 'border border-white/15 text-[var(--nexus-cyan)] hover:bg-white/5'
          }`}
        >
          Todas
        </button>
        {cameras.map((cam) => {
          const on = isCameraCoverageVisible(hiddenIds, cam.id)
          const onlyThis = on && hiddenIds.length === cameras.length - 1 && cameras.length > 1
          return (
            <span
              key={cam.id}
              className={`inline-flex shrink-0 items-center overflow-hidden rounded-md border ${
                on
                  ? 'border-emerald-400/45 bg-emerald-500/15'
                  : 'border-white/15 bg-black/30 opacity-70'
              }`}
            >
              <button
                type="button"
                title={
                  onlyThis
                    ? `${cam.label} · solo esta zona`
                    : `Ver solo ${cam.label}`
                }
                onClick={() => {
                  onSolo(cam.id)
                  onSelect?.(cam.id)
                }}
                className={`whitespace-nowrap px-2 text-[11px] font-semibold text-white ${
                  compact ? 'min-h-9' : 'min-h-8'
                }`}
              >
                {cam.label}
              </button>
              <button
                type="button"
                title={on ? `Apagar visión de ${cam.label}` : `Encender visión de ${cam.label}`}
                aria-pressed={on}
                onClick={() => onToggle(cam.id)}
                className={`flex min-w-9 items-center justify-center border-l border-white/10 text-white/90 hover:bg-white/10 ${
                  compact ? 'min-h-9' : 'min-h-8'
                }`}
              >
                {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </span>
          )
        })}
      </div>
      {compact || readOnlyHint ? null : (
        <p className="text-[10px] text-[var(--nexus-text-dim)]">
          Todas · toca el nombre para ver solo esa zona · el ojo apaga o enciende una.
          En el plano puedes arrastrar el nombre de cada cámara.
        </p>
      )}
    </div>
  )
}
