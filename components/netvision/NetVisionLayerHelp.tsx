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
    label: 'Visión',
    blurb:
      'Cobertura automática por alcance (semáforo): el verde llega hasta donde identifica un rostro a esa altura; el naranja son 1 m más; el resto del cono es rojo. Estirar el cono no agranda el verde: solo alarga el rojo. En Dual (H9c) cada lente usa su propia distancia de identificación. Si se solapan, gana verde sobre naranja y naranja sobre rojo. Ajusta la opacidad junto a Visión. Debajo del semáforo: Todas, o el nombre de cada cámara (solo esa zona) y el ojo para apagarla. Arrastra el nombre en el plano para que no tape muros o cotas.',
  },
  {
    id: 'wifi',
    label: 'WiFi',
    blurb:
      'Espectro WiFi de los APs. Drywall, bloque y concreto cortan la cobertura; vidrio, ventana y puerta solo atenúan.',
  },
  {
    id: 'sound',
    label: 'Sonido',
    blurb:
      'Plano de sonido: coloca altavoces, sirenas y micrófonos, luego configúralos. El semáforo muestra alcance; los muros atenúan.',
  },
  {
    id: 'internet',
    label: 'Internet',
    blurb:
      'Plano de red / WiFi. Coloca AP, switch, NVR o inyector en el plano amplio; tócalos para el modelo. El semáforo del AP usa el alcance de ficha.',
  },
  {
    id: 'domotica',
    label: 'Domótica',
    blurb:
      'Hubs, sensores, relés y teclados. Primero ubícalos en el plano; después ajusta modelo y alcance en la ficha.',
  },
  {
    id: 'electrico',
    label: 'Eléctrico',
    blurb:
      'Tableros, tomas, luminarias y transformadores. Mismo flujo: colocar en el plano amplio y configurar cada uno.',
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
    id: 'invert',
    label: 'Fondo negro',
    blurb:
      'Pasa el papel a negro y las rayas del plano (muros) a blanco. Las acotaciones se pueden pintar en verde, naranja, azul eléctrico o blanco. No modifica el archivo y se puede desactivar.',
  },
  {
    id: 'cotas',
    label: 'Cotas',
    blurb:
      'Con Fondo negro activo, elige el color de las acotaciones y números: verde, naranja o azul eléctrico. Auto reparte el neón según la forma de cada cota.',
  },
  {
    id: 'grosor',
    label: 'Grosor muro',
    blurb:
      'Grosor de la línea del muro seleccionado (bloque y concreto se ven igual). Si no hay muro elegido, vale para el siguiente que dibujes y para las rayas del plano en fondo negro. 0 es la más fina.',
  },
  {
    id: 'calibrate',
    label: 'Calibrar',
    blurb:
      'Arrastra el segmento sobre una cota (o toca los dos extremos). El trazo se alinea en horizontal o vertical si vas casi derecho. Escribe cuántos metros mide (4,40 o 4.40). Si el PDF trae la cota, se sugiere sola. Luego pulsa Aplicar escala.',
  },
  {
    id: 'rotate',
    label: 'Rotar',
    blurb:
      'Hay dos giros: PDF mueve solo el dibujo (las cámaras se quedan) y Cámaras mueve los equipos, muros y cables (el PDF se queda). 90° a la izquierda o a la derecha.',
  },
  {
    id: 'structures',
    label: 'Estructuras',
    blurb:
      'Muestra u oculta muros, vidrio, ventanas y puertas en el plano. Siguen afectando FOV/WiFi/sonido aunque la capa esté oculta.',
  },
  {
    id: 'muros',
    label: 'Muros',
    blurb:
      'Pestaña Muros: detecta muros, puertas y ventanas de un PDF vectorial (CAD) o dibújalos a mano. Drywall/bloque/concreto cortan el FOV. Arrastra para mover; la capa Estructuras las muestra u oculta.',
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
