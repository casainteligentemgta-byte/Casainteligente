'use client'

import { useEffect, useState } from 'react'
import NetVisionCollapsible from '@/components/netvision/NetVisionCollapsible'
import type {
  AvisoDimension,
  DimGrabacion,
  DimUps,
} from '@/lib/netvision/services/dimensionamiento'

type Props = {
  grabacion: DimGrabacion
  ups: DimUps
  onDias: (dias: number) => void
  onMinutos: (minutos: number) => void
  disabled?: boolean
}

const PUNTO: Record<AvisoDimension['nivel'], string> = {
  ok: 'bg-emerald-400',
  falta: 'bg-amber-400',
  info: 'bg-slate-400',
}

const ETIQUETA: Record<AvisoDimension['nivel'], string> = {
  ok: 'Bien',
  falta: 'Falta',
  info: 'Dato',
}

function Avisos({ avisos }: { avisos: AvisoDimension[] }) {
  return (
    <ul className="space-y-1">
      {avisos.map((a, i) => (
        <li
          key={i}
          data-nv-dim-aviso={a.nivel}
          className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-[11px] leading-snug ${
            a.nivel === 'falta'
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-50'
              : a.nivel === 'ok'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50'
                : 'border-white/10 bg-black/25 text-[var(--nexus-text-muted)]'
          }`}
        >
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PUNTO[a.nivel]}`} aria-hidden />
          <span>
            <span className="sr-only">{ETIQUETA[a.nivel]}: </span>
            {a.texto}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Campo numérico que deja escribir libremente y confirma el valor válido. */
function CampoNumero({
  etiqueta,
  unidad,
  valor,
  min,
  max,
  disabled,
  onChange,
  dataAttr,
}: {
  etiqueta: string
  unidad: string
  valor: number
  min: number
  max: number
  disabled?: boolean
  onChange: (n: number) => void
  dataAttr: string
}) {
  const [texto, setTexto] = useState(String(valor))
  useEffect(() => {
    setTexto(String(valor))
  }, [valor])
  return (
    <label className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-[var(--nexus-text-dim)]">{etiqueta}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={texto}
          disabled={disabled}
          {...{ [dataAttr]: '' }}
          onChange={(e) => {
            setTexto(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) {
              onChange(Math.round(n))
            }
          }}
          onBlur={() => setTexto(String(valor))}
          className="min-h-9 w-20 rounded border border-white/15 bg-black/40 px-2 text-right font-semibold text-white disabled:opacity-40"
        />
        <span className="w-8 text-[var(--nexus-text-dim)]">{unidad}</span>
      </span>
    </label>
  )
}

/**
 * Dimensionamiento: ¿alcanzan el grabador, el disco y el UPS para lo que se pide?
 */
export default function NetVisionDimensionamiento({
  grabacion,
  ups,
  onDias,
  onMinutos,
  disabled,
}: Props) {
  const faltas =
    grabacion.avisos.filter((a) => a.nivel === 'falta').length +
    ups.avisos.filter((a) => a.nivel === 'falta').length
  const resumen =
    grabacion.camaras === 0
      ? 'Coloca cámaras para calcular'
      : faltas === 0
        ? `Todo alcanza · ${grabacion.tbNecesarios} TB · ${ups.wTotal} W`
        : `${faltas} ${faltas === 1 ? 'punto por resolver' : 'puntos por resolver'}`

  return (
    <NetVisionCollapsible title="Dimensionamiento" summary={resumen} defaultOpen>
      <div data-nv-dimensionamiento className="space-y-3">
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
            Grabación
          </p>
          <CampoNumero
            etiqueta="Días que quieres guardar"
            unidad="días"
            valor={grabacion.dias}
            min={1}
            max={365}
            disabled={disabled}
            onChange={onDias}
            dataAttr="data-nv-dim-dias"
          />
          {grabacion.camaras > 0 ? (
            <p className="text-[11px] text-[var(--nexus-text-muted)]">
              {grabacion.camaras} {grabacion.camaras === 1 ? 'cámara' : 'cámaras'} ·{' '}
              {grabacion.mbps} Mbps ·{' '}
              <span data-nv-dim-tb className="font-semibold text-white">
                {grabacion.tbNecesarios} TB
              </span>{' '}
              para {grabacion.dias} {grabacion.dias === 1 ? 'día' : 'días'}
            </p>
          ) : null}
          <Avisos avisos={grabacion.avisos} />
        </section>

        <section className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
            Respaldo eléctrico (UPS)
          </p>
          <CampoNumero
            etiqueta="Minutos de respaldo"
            unidad="min"
            valor={ups.minutos}
            min={5}
            max={480}
            disabled={disabled}
            onChange={onMinutos}
            dataAttr="data-nv-dim-minutos"
          />
          {ups.wTotal > 0 ? (
            <p className="text-[11px] text-[var(--nexus-text-muted)]">
              Consumo{' '}
              <span data-nv-dim-watts className="font-semibold text-white">
                {ups.wTotal} W
              </span>{' '}
              (cámaras {ups.wCamaras} · red {ups.wRed} · grabador {ups.wGrabadores} · discos{' '}
              {ups.wDiscos}) · UPS recomendado{' '}
              <span data-nv-dim-va className="font-semibold text-white">
                {ups.vaRecomendado} VA
              </span>
            </p>
          ) : null}
          <Avisos avisos={ups.avisos} />
        </section>

        <p className="text-[10px] leading-relaxed text-[var(--nexus-text-dim)]">
          Estimado con grabación continua a la calidad de la ficha de cada cámara. La pantalla no se
          cuenta en el UPS.
        </p>
      </div>
    </NetVisionCollapsible>
  )
}
