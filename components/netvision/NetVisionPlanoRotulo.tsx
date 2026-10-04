'use client'

import type { ReactNode } from 'react'
import type { PlanoRotuloInfo } from '@/lib/netvision/utils/planoRotulo'

export default function NetVisionPlanoRotulo({
  rotulo,
  children,
}: {
  rotulo: PlanoRotuloInfo
  children: ReactNode
}) {
  return (
    <div className="nv-plano-rotulo flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] border border-[rgba(0,242,254,0.28)] bg-[#05080d]">
      <header className="pointer-events-none shrink-0 border-b border-[rgba(0,242,254,0.22)] px-3 py-1.5 text-center">
        <p className="truncate text-[13px] font-bold uppercase tracking-[0.14em] text-white sm:text-[15px]">
          {rotulo.projectName}
        </p>
      </header>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
      <footer className="pointer-events-none grid shrink-0 grid-cols-3 items-center gap-2 border-t border-[rgba(0,242,254,0.22)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]">
        <span className="truncate text-white/80">{rotulo.company}</span>
        <span className="truncate text-center text-white/70">{rotulo.dateLabel}</span>
        <span className="truncate text-right text-[var(--nexus-cyan)]">{rotulo.planType}</span>
      </footer>
    </div>
  )
}
