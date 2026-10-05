'use client'

import type { AlcanceUtilCamara } from '@/lib/netvision/services/dimensionamiento'
import type { UnitSystem } from '@/lib/netvision/types'
import { formatLength } from '@/lib/netvision/utils/units'

type Props = {
  alcance: AlcanceUtilCamara
  unitSystem?: UnitSystem
  /** `tactico`: vista del cliente (verde fósforo). `nexus`: editor. */
  variant?: 'nexus' | 'tactico'
}

/**
 * Distancia útil de una cámara: hasta dónde identifica un rostro, reconoce a una
 * persona o solo detecta presencia. Estimado por resolución y ángulo.
 */
export default function NetVisionAlcanceUtil({
  alcance,
  unitSystem = 'metric',
  variant = 'nexus',
}: Props) {
  const tac = variant === 'tactico'
  const dist = (m: number) => formatLength(m, unitSystem, 1)
  const fila = tac ? 'text-[#a9e8c4]' : 'text-[var(--nexus-text-muted)]'
  const valor = tac ? 'text-[#d6ffe5]' : 'text-white'
  return (
    <div
      data-nv-alcance-util
      className={
        tac
          ? 'space-y-1.5 border border-[#2e7d54] bg-[#07110d]/60 px-2.5 py-2 text-[11px]'
          : 'space-y-1.5 rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-[11px]'
      }
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          tac ? 'text-[#8cffb5]' : 'text-[var(--nexus-cyan)]'
        }`}
      >
        Distancia útil (de día)
      </p>
      {alcance.lentes.map((l) => (
        <div key={l.lensId} className="space-y-0.5">
          {alcance.lentes.length > 1 ? (
            <p className={`text-[10px] font-semibold ${valor}`}>
              {l.etiqueta} · {l.fovDeg}°
            </p>
          ) : null}
          <p className={`flex justify-between gap-2 ${fila}`}>
            <span>Identificar un rostro</span>
            <span className={`font-semibold ${valor}`}>hasta {dist(l.identificarM)}</span>
          </p>
          <p className={`flex justify-between gap-2 ${fila}`}>
            <span>Reconocer a una persona</span>
            <span className={`font-semibold ${valor}`}>hasta {dist(l.reconocerM)}</span>
          </p>
          <p className={`flex justify-between gap-2 ${fila}`}>
            <span>Detectar presencia</span>
            <span className={`font-semibold ${valor}`}>hasta {dist(l.detectarM)}</span>
          </p>
        </div>
      ))}
      <p className={`text-[10px] leading-relaxed ${tac ? 'text-[#5fbf8a]' : 'text-[var(--nexus-text-dim)]'}`}>
        De noche llega hasta {dist(alcance.nocheM)}. Estimado por resolución ({alcance.resolucion})
        y ángulo; no es una prueba en sitio.
      </p>
    </div>
  )
}
