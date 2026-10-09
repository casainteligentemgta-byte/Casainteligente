'use client'

import { RotateCcw, RotateCw } from 'lucide-react'

type Props = {
  calibrating: boolean
  disabled?: boolean
  /** Recargó el plano sobre cámaras ya guardadas: rotar no mueve equipos. */
  alignSavedDesign?: boolean
  onRotateLeft: () => void
  onRotateRight: () => void
  onCalibrate: () => void
  onOk: () => void
}

/** Primera carga del plano: rotar, calibrar y OK. Sin apariencia. */
export default function NetVisionPlanoSetupMenu({
  calibrating,
  disabled = false,
  alignSavedDesign = false,
  onRotateLeft,
  onRotateRight,
  onCalibrate,
  onOk,
}: Props) {
  return (
    <div
      data-nv-plano-setup
      data-nv-alinear={alignSavedDesign ? '1' : undefined}
      className="pointer-events-auto w-[min(20.5rem,calc(100%-1.5rem))] rounded-xl border border-cyan-400/40 bg-[#071018]/95 p-2.5 shadow-xl backdrop-blur-md"
    >
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
        Ajustar plano
      </p>
      <p className="mt-0.5 px-0.5 text-[11px] leading-snug text-white/70">
        {alignSavedDesign
          ? 'Gira solo la imagen hasta que coincida con las cámaras. Los equipos no se mueven.'
          : 'Gira la imagen, calibra una medida conocida y pulsa OK.'}
      </p>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          title="Rotar 90° a la izquierda"
          aria-label="Rotar el plano a la izquierda"
          disabled={disabled}
          onClick={onRotateLeft}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Rotar 90° a la derecha"
          aria-label="Rotar el plano a la derecha"
          disabled={disabled}
          onClick={onRotateRight}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10 disabled:opacity-40"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <span className="mr-1 text-[11px] font-semibold text-white/80">Rotar</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onCalibrate}
          className={`min-h-10 flex-1 rounded-lg px-2.5 text-[11px] font-semibold disabled:opacity-40 ${
            calibrating
              ? 'bg-[var(--nexus-cyan)] text-black'
              : 'border border-white/20 text-[var(--nexus-cyan)] hover:bg-white/10'
          }`}
        >
          Calibrar
        </button>
      </div>
      <button
        type="button"
        onClick={onOk}
        className="mt-2 min-h-11 w-full rounded-lg bg-[var(--nexus-cyan)] px-3 text-[13px] font-bold text-black hover:brightness-110"
      >
        OK
      </button>
    </div>
  )
}
