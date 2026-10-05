'use client'

import type { ZanjaModo } from '@/lib/netvision/types'

type Props = {
  modo: ZanjaModo
  onChange: (modo: ZanjaModo) => void
  /** Metros de canalización subterránea del plano (0 = no hay zanja). */
  metros: number
  disabled?: boolean
}

const OPCIONES: { id: ZanjaModo; label: string; ayuda: string }[] = [
  { id: 'cobrar', label: 'Cobrar', ayuda: 'Entra a la lista de materiales y al presupuesto.' },
  { id: 'no_cobrar', label: 'No cobrar', ayuda: 'Se dibuja en el plano, pero no se cobra.' },
  {
    id: 'otro_contratista',
    label: 'Otro contratista',
    ayuda: 'La hace otro contratista: aparece como nota sin monto.',
  },
]

/** Quién cobra la zanja: solo entra al presupuesto si se elige «Cobrar». */
export default function NetVisionZanjaModo({ modo, onChange, metros, disabled }: Props) {
  const actual = OPCIONES.find((o) => o.id === modo) ?? OPCIONES[1]!
  return (
    <div
      data-nv-zanja
      className="space-y-1.5 rounded-lg border border-orange-400/30 bg-orange-400/10 p-2 text-[11px]"
    >
      <p className="font-semibold text-orange-100">
        Zanja / canalización subterránea
        {metros > 0 ? <span className="font-normal text-orange-200/80"> · {metros} m</span> : null}
      </p>
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Cobro de la zanja">
        {OPCIONES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={modo === o.id}
            data-nv-zanja-opcion={o.id}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`min-h-10 rounded-md px-1.5 text-[11px] font-semibold leading-tight disabled:opacity-40 ${
              modo === o.id
                ? 'bg-orange-400 text-black'
                : 'border border-orange-400/40 text-orange-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-orange-100/80">{actual.ayuda}</p>
    </div>
  )
}
