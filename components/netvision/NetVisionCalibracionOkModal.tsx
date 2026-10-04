'use client'

import { createPortal } from 'react-dom'
import { CheckCircle2 } from 'lucide-react'
import type { CalibrationOk } from '@/lib/netvision/utils/scaleCalibration'
import { formatLength } from '@/lib/netvision/utils/units'
import type { UnitSystem } from '@/lib/netvision/types'

type Props = {
  result: CalibrationOk
  unitSystem: UnitSystem
  onClose: () => void
}

export default function NetVisionCalibracionOkModal({
  result,
  unitSystem,
  onClose,
}: Props) {
  const pct = Math.round(result.segmentNorm * 100)
  const source =
    result.source === 'cota'
      ? `Se usó la cota del plano (${result.label} m).`
      : `Se usó el valor que escribiste (${result.label}).`
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nv-calib-ok-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-emerald-400/35 bg-[#071018] p-4 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
          <div>
            <h2 id="nv-calib-ok-title" className="text-sm font-bold text-emerald-200">
              Calibrado realizado con éxito
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-white/80">
              La línea que marcaste equivale a{' '}
              <span className="font-semibold text-white">
                {formatLength(result.meters, unitSystem)}
              </span>{' '}
              ({pct}% del plano).
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/80">
              El plano queda en unos{' '}
              <span className="font-semibold text-white">
                {formatLength(result.planWidthM, unitSystem)}
              </span>{' '}
              de lado a lado. Las cámaras ya usan metros reales.
            </p>
            <p className="mt-1.5 text-[11px] text-[var(--nexus-text-dim)]">{source}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-bold text-black hover:bg-emerald-400"
        >
          Entendido
        </button>
      </div>
    </div>,
    document.body,
  )
}
