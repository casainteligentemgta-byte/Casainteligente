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
  submenu?: ReactNode
}

/** Pestañas de rama bajo NetVision + submenú contextual. */
export default function NetVisionBranchNav({ active, onSelect, submenu }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {NETVISION_BRANCHES.map(({ id, label }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
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
      {submenu ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
          {submenu}
        </div>
      ) : null}
    </div>
  )
}
