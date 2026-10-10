'use client'

import { RotateCcw, RotateCw } from 'lucide-react'
import type { PlanoRotateDir } from '@/lib/netvision/utils/rotatePlano'

type Props = {
  disabled?: boolean
  pdfDisabled?: boolean
  camerasDisabled?: boolean
  variant?: 'setup' | 'side'
  onRotatePdf: (dir: PlanoRotateDir) => void
  onRotateCameras: (dir: PlanoRotateDir) => void
}

function RotatePair({
  layer,
  label,
  hint,
  disabled,
  large,
  onRotate,
}: {
  layer: 'pdf' | 'camaras'
  label: string
  hint?: string
  disabled?: boolean
  large?: boolean
  onRotate: (dir: PlanoRotateDir) => void
}) {
  const btn = large
    ? 'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10 disabled:opacity-40'
    : 'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-white hover:bg-white/10 disabled:opacity-40'
  const icon = large ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const nombre = layer === 'pdf' ? 'el PDF' : 'las cámaras'
  return (
    <div className="flex items-center gap-1" data-nv-rotar={layer}>
      <button
        type="button"
        title={`Girar ${nombre} 90° a la izquierda`}
        aria-label={`Girar ${nombre} a la izquierda`}
        data-nv-rotar-dir="ccw"
        disabled={disabled}
        onClick={() => onRotate('ccw')}
        className={btn}
      >
        <RotateCcw className={icon} />
      </button>
      <button
        type="button"
        title={`Girar ${nombre} 90° a la derecha`}
        aria-label={`Girar ${nombre} a la derecha`}
        data-nv-rotar-dir="cw"
        disabled={disabled}
        onClick={() => onRotate('cw')}
        className={btn}
      >
        <RotateCw className={icon} />
      </button>
      <span className="min-w-0 pl-0.5">
        <span
          className={`block font-semibold ${large ? 'text-[12px] text-white/90' : 'text-[11px] text-[var(--nexus-cyan)]'}`}
        >
          {label}
        </span>
        {hint ? (
          <span className="block text-[10px] leading-tight text-white/55">{hint}</span>
        ) : null}
      </span>
    </div>
  )
}

/** Dos giros independientes: el PDF/imagen, o las cámaras (sin el plano). */
export default function NetVisionRotateLayers({
  disabled = false,
  pdfDisabled = false,
  camerasDisabled = false,
  variant = 'side',
  onRotatePdf,
  onRotateCameras,
}: Props) {
  const large = variant === 'setup'
  return (
    <div className={large ? 'space-y-2' : 'space-y-1.5'} data-nv-rotar-capas>
      <RotatePair
        layer="pdf"
        label="PDF"
        hint={large ? 'Gira el dibujo. Las cámaras no se mueven.' : 'Solo el dibujo'}
        disabled={disabled || pdfDisabled}
        large={large}
        onRotate={onRotatePdf}
      />
      <RotatePair
        layer="camaras"
        label="Cámaras"
        hint={large ? 'Gira los equipos. El PDF se queda.' : 'Solo los equipos'}
        disabled={disabled || camerasDisabled}
        large={large}
        onRotate={onRotateCameras}
      />
    </div>
  )
}
