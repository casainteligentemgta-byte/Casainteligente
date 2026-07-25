'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const NETVISION_BRANCHES = [
  { id: 'cctv', label: 'CCTV' },
  { id: 'red', label: 'Red' },
  { id: 'muros', label: 'Muros' },
  { id: 'cable', label: 'Cable' },
  { id: 'sub', label: 'Sub' },
  { id: 'norm', label: 'Norm' },
  { id: 'ajustes', label: 'Ajustes' },
] as const

export type NetVisionBranchId = (typeof NETVISION_BRANCHES)[number]['id']

type Props = {
  active: NetVisionBranchId
  onSelect: (id: NetVisionBranchId) => void
  /** Acciones de proyecto (Nuevo plano… Manual), van a la izquierda con scroll. */
  projectActions?: ReactNode
  submenu?: ReactNode
}

/** Barra bajo NetVision: acciones a la izquierda; ramas ancladas a la derecha. */
export default function NetVisionBranchNav({
  active,
  onSelect,
  projectActions,
  submenu,
}: Props) {
  const branches = (
    <div className="flex shrink-0 flex-nowrap items-center gap-1">
      {NETVISION_BRANCHES.map(({ id, label }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            className={cn(
              'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
              isActive
                ? 'bg-[var(--nexus-cyan)] text-black'
                : 'text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white',
            )}
            aria-pressed={isActive}
            onClick={() => onSelect(id)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex w-full min-w-0 items-center gap-2">
        {projectActions ? (
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {projectActions}
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        {projectActions ? (
          <span
            className="hidden h-5 w-px shrink-0 bg-white/15 sm:block"
            aria-hidden
          />
        ) : null}
        {/* Ramas a la derecha: hueco marcado junto al panel. */}
        <div className="ml-auto shrink-0 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {branches}
        </div>
      </div>
      {submenu ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-2">
          {submenu}
        </div>
      ) : null}
    </div>
  )
}
