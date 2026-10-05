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
 * Distancia útil de una cámara: hasta dónde identifica un rostro, reconoce a
 * una persona o solo detecta presencia. Depende de la lente y de la altura de
 * montaje, no del cono recortado en el plano.
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
  const tenue = tac ? 'text-[#5fbf8a]' : 'text-[var(--nexus-text-dim)]'
  const deFabricante = alcance.lentes.some((l) => l.fuente === 'fabricante')
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
        Distancia útil · de día · a {dist(alcance.alturaM)} de altura
      </p>
      {alcance.lentes.map((l) => (
        <div key={l.lensId} data-nv-alcance-lente={l.lensId} className="space-y-0.5">
          <p className={`text-[10px] font-semibold ${valor}`}>
            {alcance.lentes.length > 1 ? `${l.etiqueta} · ` : ''}
            {l.focalMm ? `Lente ${l.focalMm} mm · ` : ''}
            {l.fovDeg}° · {l.pixelesAncho} px
          </p>
          <p className={`flex justify-between gap-2 ${fila}`}>
            <span>Identificar un rostro</span>
            <span data-nv-alcance="identificar" className={`font-semibold ${valor}`}>
              {l.identificarM > 0 ? `hasta ${dist(l.identificarM)}` : 'no alcanza'}
            </span>
          </p>
          <p className={`flex justify-between gap-2 ${fila}`}>
            <span>Reconocer a una persona</span>
            <span data-nv-alcance="reconocer" className={`font-semibold ${valor}`}>
              {l.reconocerM > 0 ? `hasta ${dist(l.reconocerM)}` : 'no alcanza'}
            </span>
          </p>
          <p className={`flex justify-between gap-2 ${fila}`}>
            <span>Detectar presencia</span>
            <span data-nv-alcance="detectar" className={`font-semibold ${valor}`}>
              hasta {dist(l.detectarM)}
            </span>
          </p>
          <p className={`flex justify-between gap-2 ${fila}`}>
            <span>De noche (luz de la cámara)</span>
            <span className={`font-semibold ${valor}`}>hasta {dist(l.nocheM)}</span>
          </p>
          {l.aviso ? (
            <p
              data-nv-alcance-aviso
              className={`mt-1 border-l-2 pl-2 leading-snug ${
                tac ? 'border-[#ffc857] text-[#ffc857]' : 'border-amber-400 text-amber-200'
              }`}
            >
              {l.aviso}
            </p>
          ) : null}
        </div>
      ))}
      <p className={`text-[10px] leading-relaxed ${tenue}`}>
        {deFabricante
          ? 'Según la tabla DORI de la ficha del fabricante.'
          : 'Calculado con la resolución y el ángulo de la lente.'}{' '}
        Depende de la lente y la altura, no del cono dibujado en el plano. Es una referencia, no
        una prueba en sitio.
      </p>
    </div>
  )
}
