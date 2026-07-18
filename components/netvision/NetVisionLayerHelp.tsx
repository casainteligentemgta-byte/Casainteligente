'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [mounted, setMounted] = useState(false)
  const panelId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            role="presentation"
          >
            <button
              type="button"
              aria-label="Cerrar guía de capas"
              className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Guía rápida de capas del plano"
              className="relative z-10 w-[min(92vw,380px)] max-h-[min(82vh,560px)] overflow-hidden rounded-2xl border border-[rgba(0,242,254,0.35)] bg-[#071018]/97 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-white">
                    Capas del plano
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--nexus-text-dim)]">
                    Activan o ocultan información sobre el diseño. No instalan equipos.
                  </p>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--nexus-text-muted)] hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="max-h-[min(62vh,440px)] space-y-2 overflow-auto pr-0.5">
                {NETVISION_LAYER_HELP.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5"
                  >
                    <span className="text-xs font-semibold text-[var(--nexus-cyan)]">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-[12px] leading-snug text-[var(--nexus-text-muted)]">
                      {item.blurb}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={`inline-flex ${className}`}>
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
      {dialog}
    </div>
  )
}
