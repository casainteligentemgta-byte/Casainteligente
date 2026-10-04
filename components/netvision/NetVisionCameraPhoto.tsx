'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CameraModel } from '@/lib/netvision/types'
import { formFactorLabel } from '@/lib/netvision/utils/clienteCameraCard'

type FormFactor = CameraModel['formFactor']

/** Silueta genérica por forma: se usa cuando el modelo aún no tiene foto. */
function CameraSilhouette({ form }: { form: FormFactor }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-11 w-11"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {form === 'dome' ? (
        <>
          <path d="M8 20h48" />
          <path d="M14 20v6a18 18 0 0 0 36 0v-6" />
          <circle cx="32" cy="31" r="6" />
        </>
      ) : form === 'ptz' ? (
        <>
          <path d="M22 10h20v9H22z" />
          <circle cx="32" cy="36" r="16" />
          <circle cx="32" cy="40" r="6" />
        </>
      ) : (
        <>
          <path d="M12 23l4-6h30l4 6" />
          <rect x="14" y="23" width="34" height="16" rx="3" />
          <path d="M48 26h6v10h-6" />
          <path d="M26 39v8H12" />
          <path d="M9 41v12" />
        </>
      )}
    </svg>
  )
}

const BRACKET = 'pointer-events-none absolute h-3 w-3 border-[#8cffb5]'

/**
 * Foto del modelo de cámara para la ficha del cliente.
 * Con foto: se puede tocar para ampliarla. Sin foto (o si no carga): silueta por forma.
 */
export default function NetVisionCameraPhoto({
  imageUrl,
  formFactor,
  alt,
}: {
  imageUrl: string | null
  formFactor: FormFactor
  alt: string
}) {
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(false)
  const hasPhoto = Boolean(imageUrl) && !failed

  useEffect(() => {
    setFailed(false)
  }, [imageUrl])

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  return (
    <div
      data-nv-foto-modelo={hasPhoto ? 'foto' : 'silueta'}
      className="relative h-24 w-24 shrink-0 bg-[#e9fff1] text-[#0b3b22]"
    >
      <span className={`${BRACKET} -left-1 -top-1 border-l-2 border-t-2`} />
      <span className={`${BRACKET} -right-1 -top-1 border-r-2 border-t-2`} />
      <span className={`${BRACKET} -bottom-1 -left-1 border-b-2 border-l-2`} />
      <span className={`${BRACKET} -bottom-1 -right-1 border-b-2 border-r-2`} />
      {hasPhoto ? (
        <button
          type="button"
          title="Ampliar foto del modelo"
          onClick={() => setZoom(true)}
          className="block h-full w-full touch-manipulation print:pointer-events-none"
        >
          <img
            src={imageUrl ?? undefined}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain p-1"
          />
        </button>
      ) : (
        <div
          role="img"
          aria-label={`${alt} (silueta: ${formFactorLabel(formFactor)})`}
          className="flex h-full w-full flex-col items-center justify-center gap-1"
        >
          <CameraSilhouette form={formFactor} />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
            {formFactorLabel(formFactor)}
          </span>
        </div>
      )}

      {zoom && hasPhoto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black/90 p-6 print:hidden"
        >
          <button
            type="button"
            title="Cerrar"
            onClick={() => setZoom(false)}
            className="absolute right-4 top-4 flex min-h-11 min-w-11 items-center justify-center border border-[#8cffb5] text-[#8cffb5]"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={imageUrl ?? undefined}
            alt={alt}
            className="max-h-[78dvh] max-w-full bg-[#e9fff1] object-contain p-3"
          />
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-[#d6ffe5]">
            {alt}
          </p>
        </div>
      ) : null}
    </div>
  )
}
