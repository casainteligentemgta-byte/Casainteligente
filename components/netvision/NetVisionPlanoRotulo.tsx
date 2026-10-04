'use client'

import type { ReactNode } from 'react'
import type { PlanoRotuloInfo } from '@/lib/netvision/utils/planoRotulo'
import NetVisionCompanyMark from '@/components/netvision/NetVisionCompanyMark'

const TAC_BRACKET = 'pointer-events-none absolute z-10 h-5 w-5 border-[#8cffb5]'

export default function NetVisionPlanoRotulo({
  rotulo,
  children,
  variant = 'nexus',
}: {
  rotulo: PlanoRotuloInfo
  children: ReactNode
  /** `tactico`: marco verde fósforo con esquinas tipo visor (presentación al cliente). */
  variant?: 'nexus' | 'tactico'
}) {
  if (variant === 'tactico') {
    return (
      <div className="nv-plano-rotulo relative flex h-full min-h-0 flex-col overflow-hidden border border-[#2e7d54] bg-[#07110d] font-mono">
        <span className={`${TAC_BRACKET} left-0 top-0 border-l-[3px] border-t-[3px]`} />
        <span className={`${TAC_BRACKET} right-0 top-0 border-r-[3px] border-t-[3px]`} />
        <span className={`${TAC_BRACKET} bottom-0 left-0 border-b-[3px] border-l-[3px]`} />
        <span className={`${TAC_BRACKET} bottom-0 right-0 border-b-[3px] border-r-[3px]`} />
        <header className="pointer-events-none shrink-0 border-b border-[#2e7d54] px-6 py-2 text-center">
          <p className="truncate text-[12px] font-bold uppercase tracking-[0.3em] text-[#d6ffe5] sm:text-[14px]">
            {rotulo.projectName}
          </p>
        </header>
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
        <footer className="pointer-events-none grid shrink-0 grid-cols-3 items-center gap-2 border-t border-[#2e7d54] px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px]">
          <NetVisionCompanyMark company={rotulo.company} size={24} className="text-[#8cffb5]" />
          <span className="truncate text-center text-[#8cffb5]">{rotulo.dateLabel}</span>
          <span className="truncate text-right font-bold text-[#d6ffe5]">{rotulo.planType}</span>
        </footer>
      </div>
    )
  }

  return (
    <div className="nv-plano-rotulo flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] border border-[rgba(0,242,254,0.28)] bg-[#05080d]">
      <header className="pointer-events-none shrink-0 border-b border-[rgba(0,242,254,0.22)] px-3 py-1.5 text-center">
        <p className="truncate text-[13px] font-bold uppercase tracking-[0.14em] text-white sm:text-[15px]">
          {rotulo.projectName}
        </p>
      </header>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
      <footer className="pointer-events-none grid shrink-0 grid-cols-3 items-center gap-2 border-t border-[rgba(0,242,254,0.28)] bg-[#071018] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]">
        <NetVisionCompanyMark
          company={rotulo.company}
          size={26}
          className="text-white"
        />
        <span className="truncate text-center text-white/80">{rotulo.dateLabel}</span>
        <span className="truncate text-right text-[var(--nexus-cyan)]">{rotulo.planType}</span>
      </footer>
    </div>
  )
}
