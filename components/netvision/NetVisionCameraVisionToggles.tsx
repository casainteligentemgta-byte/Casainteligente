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
  /** `tactico`: fichas rectas en verde fósforo (presentación al cliente). */
  variant?: 'nexus' | 'tactico'
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
  variant = 'nexus',
}: NetVisionCameraVisionTogglesProps) {
  if (cameras.length === 0) return null
  const allOn = hiddenIds.length === 0
  const tac = variant === 'tactico'
  // Vista cliente: ~30 % más chicos que min-h-11 / px-3.5, para no comerse el plano.
  const rowH = tac ? 'h-[31px] min-h-[31px]' : compact ? 'min-h-9' : 'min-h-8'
  const labelPx = tac ? 'px-2' : compact ? 'px-2' : 'px-2'
  const allPx = tac ? 'px-2.5' : 'px-2.5'
  const eyeW = tac ? 'min-w-[31px]' : 'min-w-9'
  const type = tac ? 'text-[10px]' : 'text-[11px]'
  const iconClass = tac ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'

  return (
    <div className={compact ? 'min-w-0' : 'space-y-1.5'}>
      <div
        className={`flex flex-nowrap items-center overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:thin] ${
          tac ? 'gap-1' : 'gap-1.5'
        }`}
      >
        <button
          type="button"
          title="Mostrar el semáforo de todas las cámaras"
          aria-pressed={allOn}
          onClick={onShowAll}
          className={`shrink-0 ${type} ${rowH} ${
            tac
              ? `${allPx} font-bold uppercase tracking-[0.12em] ${
                  allOn
                    ? 'bg-[#8cffb5] text-[#07110d]'
                    : 'border border-[#8cffb5] text-[#8cffb5] hover:bg-[#8cffb5]/10'
                }`
              : `rounded-md ${allPx} font-semibold ${
                  allOn
                    ? 'bg-[var(--nexus-cyan)] text-black'
                    : 'border border-white/15 text-[var(--nexus-cyan)] hover:bg-white/5'
                }`
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
              className={`inline-flex shrink-0 items-center overflow-hidden border ${
                tac
                  ? on
                    ? 'border-[#4ade80] bg-[#0b1a14]'
                    : 'border-[#2e7d54] bg-[#07110d] opacity-60'
                  : `rounded-md ${
                      on
                        ? 'border-emerald-400/45 bg-emerald-500/15'
                        : 'border-white/15 bg-black/30 opacity-70'
                    }`
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
                className={`whitespace-nowrap ${type} ${rowH} ${
                  tac
                    ? `${labelPx} font-bold tracking-[0.08em] text-[#d6ffe5]`
                    : `${labelPx} font-semibold text-white`
                }`}
              >
                {cam.label}
              </button>
              <button
                type="button"
                title={on ? `Apagar visión de ${cam.label}` : `Encender visión de ${cam.label}`}
                aria-pressed={on}
                onClick={() => onToggle(cam.id)}
                className={`flex items-center justify-center border-l ${rowH} ${eyeW} ${
                  tac
                    ? 'border-[#2e7d54] text-[#8cffb5] hover:bg-[#8cffb5]/10'
                    : 'border-white/10 text-white/90 hover:bg-white/10'
                }`}
              >
                {on ? <Eye className={iconClass} /> : <EyeOff className={iconClass} />}
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
