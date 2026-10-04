'use client'

import {
  NIGHT_NEON,
  clampGrosorMuro,
  normalizeCotaColor,
  type NightCotaColor,
} from '@/lib/netvision/utils/nightPlanoPalette'
import { layerHelpTitle } from '@/components/netvision/NetVisionLayerHelp'

const COTA_CHIPS: Array<{
  id: NightCotaColor
  label: string
  color?: string
}> = [
  { id: 'auto', label: 'Auto' },
  { id: 'verde', label: 'Verde', color: `rgb(${NIGHT_NEON[0]!.join(',')})` },
  { id: 'naranja', label: 'Naranja', color: `rgb(${NIGHT_NEON[1]!.join(',')})` },
  { id: 'amarillo', label: 'Amarillo', color: `rgb(${NIGHT_NEON[2]!.join(',')})` },
]

export type NetVisionPlanoLookControlsProps = {
  invertido: boolean
  cotaColor: NightCotaColor
  grosorMuro: number
  disabled?: boolean
  compact?: boolean
  onInvertido: (value: boolean) => void
  onCotaColor: (value: NightCotaColor) => void
  onGrosorMuro: (value: number) => void
}

export default function NetVisionPlanoLookControls({
  invertido,
  cotaColor,
  grosorMuro,
  disabled = false,
  compact = false,
  onInvertido,
  onCotaColor,
  onGrosorMuro,
}: NetVisionPlanoLookControlsProps) {
  const color = normalizeCotaColor(cotaColor)
  const grosor = clampGrosorMuro(grosorMuro)

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      <button
        type="button"
        disabled={disabled}
        title={layerHelpTitle('invert')}
        aria-pressed={invertido}
        onClick={() => onInvertido(!invertido)}
        className={`flex w-full min-h-9 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold disabled:opacity-40 ${
          invertido
            ? 'bg-white text-black'
            : 'border border-white/15 text-[var(--nexus-cyan)] hover:bg-white/5'
        }`}
      >
        <span>Fondo negro</span>
        <span className={invertido ? 'text-black/70' : 'text-[var(--nexus-text-dim)]'}>
          {invertido ? 'Muros blancos' : 'Papel'}
        </span>
      </button>

      <div className={invertido ? '' : 'opacity-55'}>
        <p
          className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]"
          title={layerHelpTitle('cotas')}
        >
          Cotas
        </p>
        <div className="flex flex-wrap gap-1">
          {COTA_CHIPS.map((chip) => {
            const active = color === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                disabled={disabled || !invertido}
                title={
                  chip.id === 'auto'
                    ? 'Neón automático según la forma de cada cota'
                    : `Acotaciones en ${chip.label.toLowerCase()} fluorescente`
                }
                aria-pressed={active}
                onClick={() => onCotaColor(chip.id)}
                className={`min-h-8 rounded-md px-2 text-[11px] font-semibold disabled:opacity-40 ${
                  active
                    ? 'ring-1 ring-white/80'
                    : 'border border-white/15 bg-black/30 hover:bg-white/5'
                }`}
                style={
                  chip.color
                    ? {
                        color: chip.color,
                        backgroundColor: active ? `${chip.color}22` : undefined,
                        boxShadow: active ? `0 0 10px ${chip.color}` : undefined,
                      }
                    : active
                      ? { color: '#e2e8f0', backgroundColor: 'rgba(255,255,255,0.12)' }
                      : { color: 'var(--nexus-text-muted)' }
                }
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      <label
        className="block px-0.5"
        title={layerHelpTitle('grosor')}
      >
        <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
          Grosor muro
          <span className="tabular-nums text-[var(--nexus-cyan)]">{grosor}</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          value={grosor}
          onChange={(e) => onGrosorMuro(Number(e.target.value))}
          className="mt-1 h-1.5 w-full accent-[var(--nexus-cyan)]"
          aria-label="Grosor de la línea del muro"
        />
        <span className="mt-0.5 flex justify-between text-[10px] text-[var(--nexus-text-dim)]">
          <span>Fina</span>
          <span>Gruesa</span>
        </span>
      </label>
    </div>
  )
}
