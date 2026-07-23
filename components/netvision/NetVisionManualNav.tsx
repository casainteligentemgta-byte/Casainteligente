import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type ManualTab = 'explicativo' | 'usuario' | 'instaladores'

const tabs: { id: ManualTab; href: string; label: string }[] = [
  {
    id: 'usuario',
    href: '/nexus/vision/manual/usuario',
    label: 'Cómo manejar NetVision',
  },
  {
    id: 'explicativo',
    href: '/nexus/vision/manual/explicativo',
    label: 'Explicativo',
  },
  {
    id: 'instaladores',
    href: '/nexus/vision/manual/instaladores',
    label: 'Instaladores',
  },
]

export default function NetVisionManualNav({ active }: { active: ManualTab }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href="/nexus/vision"
        className="inline-flex items-center gap-2 text-sm text-[var(--nexus-cyan)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a NetVision Pro
      </Link>
      <div className="flex flex-wrap gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={
                isActive
                  ? 'rounded-md bg-[var(--nexus-cyan)] px-3 py-1.5 text-xs font-semibold text-black'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-[var(--nexus-text-muted)] hover:text-white'
              }
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
