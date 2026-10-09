'use client'

import { RotateCcw, RotateCw } from 'lucide-react'

type Props = {
  calibrating: boolean
  disabled?: boolean
  /** Si true, rotar gira solo el dibujo y deja las cámaras quietas. */
  soloImagen?: boolean
  onSoloImagen?: (value: boolean) => void
  onRotateLeft: () => void
  onRotateRight: () => void
  onCalibrate: () => void
  onOk: () => void
}

/** Primera carga del plano: rotar, calibrar y OK. Sin apariencia. */
export default function NetVisionPlanoSetupMenu({
  calibrating,
  disabled = false,
  soloImagen = false,
  onSoloImagen,
  onRotateLeft,
  onRotateRight,
  onCalibrate,
  onOk,
}: Props) {
  return (
    <div
      data-nv-plano-setup
      data-nv-alinear={soloImagen ? '1' : undefined}
      className="pointer-events-auto w-[min(20.5rem,calc(100%-1.5rem))] rounded-xl border border-cyan-400/40 bg-[#071018]/95 p-2.5 shadow-xl backdrop-blur-md"
    >
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
        Ajustar plano
      </p>
      <p className="mt-0.5 px-0.5 text-[11px] leading-snug text-white/70">
        {soloImagen
          ? 'Gira solo el dibujo. Las cámaras se quedan donde estaban.'
          : 'Gira el plano y las cámaras juntos. Luego calibra y pulsa OK.'}
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
      {onSoloImagen ? (
        <button
          type="button"
          data-nv-solo-imagen
          disabled={disabled}
          onClick={() => onSoloImagen(!soloImagen)}
          className={`mt-2 min-h-10 w-full rounded-lg px-2.5 text-[11px] font-semibold disabled:opacity-40 ${
            soloImagen
              ? 'bg-amber-400 text-black'
              : 'border border-white/20 text-white/80 hover:bg-white/10'
          }`}
        >
          {soloImagen ? 'Solo imagen · ON (cámaras quietas)' : 'Solo imagen (si el dibujo no calza)'}
        </button>
      ) : null}
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
