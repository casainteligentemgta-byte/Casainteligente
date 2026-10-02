'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const NETVISION_PLAN_BRANCHES = [
  { id: 'cctv', label: 'CCTV' },
  { id: 'sonido', label: 'Sonido' },
  { id: 'internet', label: 'Internet' },
  { id: 'domotica', label: 'Domótica' },
  { id: 'electrico', label: 'Eléctrico' },
] as const

export const NETVISION_TOOL_BRANCHES = [
  { id: 'muros', label: 'Muros' },
  { id: 'cable', label: 'Cable' },
  { id: 'sub', label: 'Sub' },
  { id: 'norm', label: 'Norm' },
  { id: 'ajustes', label: 'Ajustes' },
] as const

export const NETVISION_BRANCHES = [
  ...NETVISION_PLAN_BRANCHES,
  ...NETVISION_TOOL_BRANCHES,
] as const

export type NetVisionBranchId = (typeof NETVISION_BRANCHES)[number]['id']

type Props = {
  active: NetVisionBranchId
  onSelect: (id: NetVisionBranchId) => void
  /** Acciones de proyecto (Nuevo plano… Manual), van a la izquierda con scroll. */
  projectActions?: ReactNode
  submenu?: ReactNode
}

const scrollHide =
  'overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

function BranchRow({
  items,
  active,
  onSelect,
}: {
  items: readonly { id: NetVisionBranchId; label: string }[]
  active: NetVisionBranchId
  onSelect: (id: NetVisionBranchId) => void
}) {
  return (
    <div className="flex flex-nowrap items-center gap-1">
      {items.map(({ id, label }) => {
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
}

/** Barra bajo NetVision: planos de especialidad + herramientas. */
export default function NetVisionBranchNav({
  active,
  onSelect,
  projectActions,
  submenu,
}: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex w-full min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
        {projectActions ? (
          <div
            className={cn(
              'flex w-full min-w-0 flex-nowrap items-center gap-2 sm:flex-1',
              scrollHide,
            )}
          >
            {projectActions}
          </div>
        ) : null}
        <div className={cn('w-full min-w-0 sm:ml-auto sm:w-auto sm:shrink-0', scrollHide)}>
          <BranchRow items={NETVISION_PLAN_BRANCHES} active={active} onSelect={onSelect} />
        </div>
      </div>
      <div className={cn('w-full min-w-0', scrollHide)}>
        <BranchRow items={NETVISION_TOOL_BRANCHES} active={active} onSelect={onSelect} />
      </div>
      {submenu ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-1.5">
          {submenu}
        </div>
      ) : null}
    </div>
  )
}
