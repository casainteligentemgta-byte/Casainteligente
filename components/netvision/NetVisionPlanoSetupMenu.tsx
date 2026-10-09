'use client'

import type { PlanoRotateDir } from '@/lib/netvision/utils/rotatePlano'
import NetVisionRotateLayers from '@/components/netvision/NetVisionRotateLayers'

type Props = {
  calibrating: boolean
  disabled?: boolean
  camerasDisabled?: boolean
  onRotatePdf: (dir: PlanoRotateDir) => void
  onRotateCameras: (dir: PlanoRotateDir) => void
  onCalibrate: () => void
  onOk: () => void
}

/** Primera carga del plano: girar PDF o cámaras, calibrar y OK. Sin apariencia. */
export default function NetVisionPlanoSetupMenu({
  calibrating,
  disabled = false,
  camerasDisabled = false,
  onRotatePdf,
  onRotateCameras,
  onCalibrate,
  onOk,
}: Props) {
  return (
    <div
      data-nv-plano-setup
      className="pointer-events-auto w-[min(20.5rem,calc(100%-1.5rem))] rounded-xl border border-cyan-400/40 bg-[#071018]/95 p-2.5 shadow-xl backdrop-blur-md"
    >
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
        Ajustar plano
      </p>
      <p className="mt-0.5 px-0.5 text-[11px] leading-snug text-white/70">
        PDF gira el dibujo. Cámaras gira los equipos, sin el plano. Luego calibra y pulsa OK.
      </p>
      <div className="mt-2">
        <NetVisionRotateLayers
          variant="setup"
          disabled={disabled}
          camerasDisabled={camerasDisabled}
          onRotatePdf={onRotatePdf}
          onRotateCameras={onRotateCameras}
        />
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onCalibrate}
        className={`mt-2 min-h-10 w-full rounded-lg px-2.5 text-[11px] font-semibold disabled:opacity-40 ${
          calibrating
            ? 'bg-[var(--nexus-cyan)] text-black'
            : 'border border-white/20 text-[var(--nexus-cyan)] hover:bg-white/10'
        }`}
      >
        Calibrar
      </button>
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
