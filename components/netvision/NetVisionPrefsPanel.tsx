'use client'

import type { NetVisionCurrency, UnitSystem } from '@/lib/netvision/types'
import { UNIT_SYSTEM_OPTIONS } from '@/lib/netvision/utils/units'

type Props = {
  unitSystem: UnitSystem
  currency: NetVisionCurrency
  distributorMarginPct: number
  description: string
  client: string
  onChange: (patch: {
    unitSystem?: UnitSystem
    currency?: NetVisionCurrency
    distributorMarginPct?: number
    description?: string
    client?: string
  }) => void
}

const CURRENCIES: NetVisionCurrency[] = ['USD', 'VES', 'EUR']

export default function NetVisionPrefsPanel({
  unitSystem,
  currency,
  distributorMarginPct,
  description,
  client,
  onChange,
}: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
        Preferencias
      </h2>

      <label className="block text-xs">
        <span className="text-[var(--nexus-text-dim)]">Cliente (opcional)</span>
        <input
          value={client}
          onChange={(e) => onChange({ client: e.target.value })}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
          placeholder="Nombre del cliente"
        />
      </label>

      <label className="block text-xs">
        <span className="text-[var(--nexus-text-dim)]">Descripción</span>
        <textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
          placeholder="Notas del proyecto"
        />
      </label>

      <fieldset className="space-y-1.5">
        <legend className="text-[11px] text-[var(--nexus-text-dim)]">Sistema de medidas</legend>
        {UNIT_SYSTEM_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 text-xs ${
              unitSystem === opt.id
                ? 'border-[rgba(0,242,254,0.45)] bg-[rgba(0,242,254,0.08)]'
                : 'border-white/10 bg-black/25'
            }`}
          >
            <input
              type="radio"
              name="unitSystem"
              checked={unitSystem === opt.id}
              onChange={() => onChange({ unitSystem: opt.id })}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold text-white">{opt.label}</span>
              <span className="mt-0.5 block text-[10px] text-[var(--nexus-text-dim)]">
                {opt.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="text-[var(--nexus-text-dim)]">Divisa</span>
          <select
            value={currency}
            onChange={(e) => onChange({ currency: e.target.value as NetVisionCurrency })}
            className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-[var(--nexus-text-dim)]">Margen %</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={distributorMarginPct}
            onChange={(e) =>
              onChange({
                distributorMarginPct: Math.min(
                  100,
                  Math.max(0, Number(e.target.value) || 0),
                ),
              })
            }
            className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
          />
        </label>
      </div>

      <p className="text-[10px] text-[var(--nexus-text-dim)]">
        Los cálculos internos usan metros; la UI convierte según el sistema elegido. País/normas
        en la pestaña Norm.
      </p>
    </div>
  )
}
