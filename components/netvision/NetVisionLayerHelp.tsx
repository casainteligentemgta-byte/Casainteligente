'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CircleHelp, X } from 'lucide-react'

export type LayerHelpItem = {
  id: string
  label: string
  blurb: string
}

export const NETVISION_LAYER_HELP: LayerHelpItem[] = [
  {
    id: 'fov',
    label: 'FOV',
    blurb:
      'Campo de visión de cada cámara (cono/sector que “ve”). Sirve para revisar cobertura CCTV y zonas sin vigilancia.',
  },
  {
    id: 'wifi',
    label: 'WiFi',
    blurb:
      'Alcance estimado de los APs WiFi en el plano. Útil para detectar áreas sin señal.',
  },
  {
    id: 'links',
    label: 'Enlaces',
    blurb:
      'Líneas cámara → nodo PoE más cercano (switch o injector). Muestra a qué equipo se conectaría cada cámara.',
  },
  {
    id: 'routes',
    label: 'Rutas',
    blurb:
      'Trazado ortogonal del cableado (Cat6/fibra, etc.). Si está activo, tiene prioridad visual sobre Enlaces.',
  },
  {
    id: 'sub',
    label: 'Sub',
    blurb:
      'Canalización subterránea: tubería, profundidad y cámaras de acceso. Capa de obra civil bajo tierra.',
  },
  {
    id: 'night',
    label: 'Noche',
    blurb:
      'Recalcula el FOV en modo nocturno (alcance IR / visión de noche). No oscurece el plano: simula cobertura de noche.',
  },
  {
    id: 'calibrate',
    label: 'Calibrar',
    blurb:
      'Marca dos puntos en el plano e indica la distancia real en metros para fijar la escala del diseño.',
  },
]

export function layerHelpTitle(id: string): string {
  return NETVISION_LAYER_HELP.find((i) => i.id === id)?.blurb ?? ''
}

type Props = {
  className?: string
}

export default function NetVisionLayerHelp({ className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('touchstart', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('touchstart', onPointer)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Cerrar guía de capas' : 'Abrir guía de capas'}
        title="Qué significan FOV, WiFi, Enlaces…"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[var(--nexus-cyan)] transition ${
          open
            ? 'border-[var(--nexus-cyan)] bg-[var(--nexus-cyan)]/15'
            : 'border-white/15 bg-black/30 hover:border-white/30'
        }`}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Guía rápida de capas del plano"
          className="absolute left-0 top-full z-40 mt-2 w-[min(92vw,320px)] rounded-xl border border-[rgba(0,242,254,0.28)] bg-[#071018]/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white">
                Capas del plano
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--nexus-text-dim)]">
                Activan o ocultan información sobre el diseño. No instalan equipos.
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-[var(--nexus-text-muted)] hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="max-h-[min(50vh,360px)] space-y-2 overflow-auto pr-0.5">
            {NETVISION_LAYER_HELP.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"
              >
                <span className="text-[11px] font-semibold text-[var(--nexus-cyan)]">
                  {item.label}
                </span>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--nexus-text-muted)]">
                  {item.blurb}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
