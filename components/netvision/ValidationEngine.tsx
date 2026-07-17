'use client'

import type { ValidationResult } from '@/lib/netvision/types'

type Props = {
  results: ValidationResult[]
  onSelectCamera?: (id: string) => void
}

export default function ValidationEngine({ results, onSelectCamera }: Props) {
  if (results.length === 0) {
    return (
      <p className="text-xs text-[var(--nexus-text-dim)]">
        Sin alertas. Coloca cámaras para validar cobertura.
      </p>
    )
  }

  return (
    <ul className="max-h-48 space-y-2 overflow-auto pr-1">
      {results.map((r, i) => (
        <li
          key={`${r.code}-${i}`}
          className={`rounded-lg border px-2.5 py-2 text-[11px] ${tone(r.level)}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold">
              {r.code} · {r.level}
            </span>
            {r.cameraId && onSelectCamera ? (
              <button
                type="button"
                className="text-[10px] underline opacity-80"
                onClick={() => onSelectCamera(r.cameraId!)}
              >
                Ver
              </button>
            ) : null}
          </div>
          <p className="mt-0.5 text-[var(--nexus-text-muted)]">{r.message}</p>
          <p className="mt-1 text-[10px] text-[var(--nexus-text-dim)]">{r.solution}</p>
        </li>
      ))}
    </ul>
  )
}

function tone(level: ValidationResult['level']): string {
  if (level === 'ERROR') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (level === 'WARNING') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
}
