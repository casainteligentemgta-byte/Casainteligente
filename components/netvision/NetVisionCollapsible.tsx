'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

type Props = {
  title: string
  /** Resumen cuando está cerrado */
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

export default function NetVisionCollapsible({
  title,
  summary,
  defaultOpen = false,
  children,
  className = '',
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={`overflow-hidden rounded-lg border border-white/10 bg-black/25 ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
            {title}
          </span>
          {!open && summary ? (
            <span className="mt-0.5 block truncate text-[10px] text-[var(--nexus-text-dim)]">
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--nexus-cyan)] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open ? <div className="space-y-2 border-t border-white/10 px-2.5 py-2">{children}</div> : null}
    </div>
  )
}
