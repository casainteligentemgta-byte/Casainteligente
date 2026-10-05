'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
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

type FoldId = 'archivo' | 'especialidad'

type Props = {
  active: NetVisionBranchId
  onSelect: (id: NetVisionBranchId) => void
  fileLine?: ReactNode
  archivo: ReactNode
  tools?: ReactNode
  submenu?: ReactNode
}

function BranchChips({
  items,
  active,
  onSelect,
}: {
  items: readonly { id: NetVisionBranchId; label: string }[]
  active: NetVisionBranchId
  onSelect: (id: NetVisionBranchId) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map(({ id, label }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            className={cn(
              'min-h-9 shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
              isActive
                ? 'bg-[var(--nexus-cyan)] text-black'
                : 'border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950',
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

function FoldButton({
  id,
  label,
  hint,
  open,
  onToggle,
  children,
}: {
  id: FoldId
  label: string
  hint?: string
  open: FoldId | null
  onToggle: (id: FoldId) => void
  children: ReactNode
}) {
  const isOpen = open === id
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={cn(
          'inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold',
          isOpen
            ? 'bg-[var(--nexus-cyan)] text-black'
            : 'border border-white/15 text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white',
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => onToggle(id)}
      >
        {label}
        {hint ? <span className="font-medium opacity-80">· {hint}</span> : null}
        <ChevronDown className={cn('h-3.5 w-3.5', isOpen && 'rotate-180')} />
      </button>
      {isOpen ? (
        <div className="nv-fold-menu absolute left-0 top-full z-[80] mt-1 w-[min(92vw,22rem)] rounded-xl border border-zinc-200 bg-white p-2 text-zinc-900 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
          {children}
        </div>
      ) : null}
    </div>
  )
}

const activeLabel = (active: NetVisionBranchId) =>
  NETVISION_BRANCHES.find((b) => b.id === active)?.label ?? 'CCTV'

/** Barra bajo el título: archivo retraído y especialidades en un menú. */
export default function NetVisionBranchNav({
  active,
  onSelect,
  fileLine,
  archivo,
  tools,
  submenu,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<FoldId | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  const toggle = (id: FoldId) => setOpen((cur) => (cur === id ? null : id))

  return (
    <div ref={rootRef} className="space-y-1.5">
      {fileLine ? (
        <p className="truncate text-xs leading-tight text-white/85">
          {fileLine}
        </p>
      ) : null}
      <div className="flex flex-nowrap items-center gap-2">
        <FoldButton id="archivo" label="Archivo" open={open} onToggle={toggle}>
          <div
            className="flex flex-col gap-1.5"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button')) setOpen(null)
            }}
          >
            {archivo}
          </div>
        </FoldButton>
        <FoldButton
          id="especialidad"
          label="Especialidad"
          hint={activeLabel(active)}
          open={open}
          onToggle={toggle}
        >
          <div className="space-y-2">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Sistemas
            </p>
            <BranchChips
              items={NETVISION_PLAN_BRANCHES}
              active={active}
              onSelect={onSelect}
            />
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Herramientas
            </p>
            <BranchChips
              items={NETVISION_TOOL_BRANCHES}
              active={active}
              onSelect={onSelect}
            />
            {submenu ? (
              <div
                className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2"
                onClick={() => setOpen(null)}
              >
                {submenu}
              </div>
            ) : null}
          </div>
        </FoldButton>
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tools}
        </div>
      </div>
    </div>
  )
}
