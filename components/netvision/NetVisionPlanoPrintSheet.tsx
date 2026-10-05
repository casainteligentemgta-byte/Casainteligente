'use client'

import type { CSSProperties, ReactNode } from 'react'
import NetVisionCompanyMark from '@/components/netvision/NetVisionCompanyMark'
import type { PlanoPrintPayload } from '@/lib/netvision/utils/planoPrint'
import {
  contadorDosDigitos,
  rotuloFechaDigitos,
  type PlanoPrintTema,
} from '@/lib/netvision/utils/planoPrintTema'

/** Condensada pesada del sistema (sin fuentes externas). */
const CONDENSED: CSSProperties = {
  fontFamily:
    "'Avenir Next Condensed', 'Franklin Gothic Demi Cond', 'Arial Narrow', Impact, sans-serif",
}

type SheetProps = {
  payload: PlanoPrintPayload
  /** Plano interactivo cuando no hay captura guardada. */
  livePlano: ReactNode | null
}

/**
 * Contenido del recuadro del plano. El contenedor (`.nv-print-plano`) lo pone cada
 * tema; en tablet/escritorio y al imprimir, el plano llena ese recuadro (ver estilos
 * en NetVisionPlanoPrintView).
 */
function PlanoSlot({
  payload,
  livePlano,
  emptyClass,
}: SheetProps & { emptyClass: string }) {
  if (payload.imageDataUrl?.startsWith('data:image/')) {
    return (
      <img
        src={payload.imageDataUrl}
        alt={`Plano de ${payload.rotulo.projectName}`}
        className="mx-auto block h-auto max-h-[62vh] w-full object-contain"
      />
    )
  }
  if (livePlano) {
    return <div className="nv-print-live h-[62vh] min-h-[300px]">{livePlano}</div>
  }
  return (
    <p className={`p-8 text-center text-sm ${emptyClass}`}>
      No hay captura del plano. Pulsa Atrás y vuelve a exportar el PDF.
    </p>
  )
}

function plural(n: number | undefined, uno: string, varios: string) {
  return n === 1 ? uno : varios
}

/* ── Táctico: negro verdoso, verde fósforo, marco tipo visor ───────────── */

const TAC_BRACKET = 'pointer-events-none absolute z-10 h-5 w-5 border-[#8cffb5]'
const TAC_LABEL = 'text-[10px] uppercase tracking-[0.22em] text-[#5fbf8a]'

function SheetTactico({ payload, livePlano }: SheetProps) {
  const { rotulo } = payload
  const segmentos = Math.min(Math.max(payload.cameraCount ?? 0, 0), 40)
  return (
    <article className="nv-print-sheet nv-print-scan flex flex-col bg-[#07110d] p-4 font-mono text-[#8cffb5] print:p-[7mm]">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] sm:text-[11px]">
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 bg-[#8cffb5]" />
          <span className="truncate">Plano // {rotulo.planType}</span>
        </span>
        <span className="truncate text-right">{rotulo.company}</span>
      </div>

      <div className="nv-print-plano relative mt-3 border border-[#2e7d54] bg-[#05080d]">
        <span className={`${TAC_BRACKET} -left-px -top-px border-l-[3px] border-t-[3px]`} />
        <span className={`${TAC_BRACKET} -right-px -top-px border-r-[3px] border-t-[3px]`} />
        <span className={`${TAC_BRACKET} -bottom-px -left-px border-b-[3px] border-l-[3px]`} />
        <span className={`${TAC_BRACKET} -bottom-px -right-px border-b-[3px] border-r-[3px]`} />
        <PlanoSlot
          payload={payload}
          livePlano={livePlano}
          emptyClass="text-[#a9e8c4]"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_13.5rem] print:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_13.5rem]">
        <section className="flex min-w-0 flex-col justify-between gap-2 border border-[#2e7d54] px-4 py-3">
          <p className={TAC_LABEL}>Objetivo</p>
          <h1 className="break-words text-3xl font-bold uppercase leading-none tracking-[0.08em] text-[#d6ffe5] sm:text-4xl print:text-4xl">
            {rotulo.projectName}
          </h1>
          {payload.planoNombre?.trim() ? (
            <p className="truncate text-[11px] tracking-[0.04em]">
              <span className="text-[#5fbf8a]">PLANO:</span> {payload.planoNombre.trim()}
            </p>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col justify-between gap-2 border border-[#2e7d54] px-4 py-3">
          <p className={TAC_LABEL}>Unidades desplegadas</p>
          <div className="flex items-end gap-3">
            <span className="text-5xl font-bold leading-[0.85] text-[#d6ffe5]">
              {payload.cameraCount ?? '—'}
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-[11px] uppercase tracking-[0.16em]">
                {plural(payload.cameraCount, 'Cámara', 'Cámaras')}
              </p>
              {segmentos > 0 ? (
                <div className="mt-1.5 flex h-3 gap-[3px]" aria-hidden>
                  {Array.from({ length: segmentos }, (_, i) => (
                    <span key={i} className="min-w-0 flex-1 bg-[#8cffb5]" />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] tracking-[0.04em]">
            {payload.networkCount != null ? (
              <span>
                <span className="text-[#5fbf8a]">RED:</span> {payload.networkCount}
              </span>
            ) : null}
            {payload.structureCount != null ? (
              <span>
                <span className="text-[#5fbf8a]">ESTRUCTURAS:</span> {payload.structureCount}
              </span>
            ) : null}
          </p>
        </section>

        <section className="flex min-w-0 flex-col justify-between gap-2 border border-[#2e7d54] px-4 py-3 text-[11px]">
          <p className="flex justify-between gap-3">
            <span className="text-[#5fbf8a]">FECHA</span>
            <span className="text-right text-[#d6ffe5]">
              {rotuloFechaDigitos(rotulo.dateLabel) ?? rotulo.dateLabel}
            </span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-[#5fbf8a]">TIPO</span>
            <span className="text-right font-bold uppercase text-[#d6ffe5]">{rotulo.planType}</span>
          </p>
          <NetVisionCompanyMark
            company={rotulo.company}
            size={28}
            className="font-semibold uppercase tracking-[0.06em] text-[#d6ffe5]"
          />
        </section>
      </div>
    </article>
  )
}

/* ── Tiempo real: negro, paneles ámbar, lectura digital ────────────────── */

const TR_BOX = 'border-2 border-[#ffb000] px-4 py-3'
const TR_LABEL = 'text-[12px] font-semibold uppercase tracking-[0.22em] text-[#c8c8c8]'
const TR_DIGITS: CSSProperties = { textShadow: '0 0 14px rgba(255, 176, 0, 0.55)' }

function SheetTiempoReal({ payload, livePlano }: SheetProps) {
  const { rotulo } = payload
  const fecha = rotuloFechaDigitos(rotulo.dateLabel)
  const contadores: Array<[string, number | undefined]> = [
    [plural(payload.cameraCount, 'Cámara', 'Cámaras'), payload.cameraCount],
    ['Red', payload.networkCount],
    ['Estruct.', payload.structureCount],
  ]
  return (
    <article
      className="nv-print-sheet grid gap-2 bg-[#050505] p-4 text-[#f2f2f2] sm:grid-cols-[minmax(0,1fr)_17.5rem] sm:grid-rows-[minmax(0,1fr)] print:grid-cols-[minmax(0,1fr)_17.5rem] print:grid-rows-[minmax(0,1fr)] print:p-[7mm]"
      style={CONDENSED}
    >
      <div className="nv-print-plano relative min-w-0 border-2 border-[#ffb000] bg-[#05080d]">
        <PlanoSlot payload={payload} livePlano={livePlano} emptyClass="text-[#c8c8c8]" />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <section className={TR_BOX}>
          <p className={TR_LABEL}>Fecha</p>
          <p
            className={`mt-1.5 font-mono font-bold leading-none text-[#ffb000] ${
              fecha ? 'text-[2rem] tracking-[0.04em]' : 'text-base uppercase'
            }`}
            style={TR_DIGITS}
          >
            {fecha ?? rotulo.dateLabel}
          </p>
        </section>

        <section className={`${TR_BOX} flex flex-1 flex-col justify-between gap-4`}>
          <p className={TR_LABEL}>Plano de {rotulo.planType}</p>
          <div>
            <h1 className="break-words text-[2.5rem] font-bold uppercase leading-[0.92]">
              {rotulo.projectName}
            </h1>
            {payload.planoNombre?.trim() ? (
              <p className="mt-2 break-words text-base text-[#c8c8c8]">
                {payload.planoNombre.trim()}
              </p>
            ) : null}
          </div>
        </section>

        <section className={`${TR_BOX} grid grid-cols-3 gap-2`}>
          {contadores.map(([label, n]) => (
            <div key={label} className="min-w-0">
              <p
                className="font-mono text-[2rem] font-bold leading-none text-[#ffb000]"
                style={TR_DIGITS}
              >
                {contadorDosDigitos(n)}
              </p>
              <p className="mt-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c8c8c8]">
                {label}
              </p>
            </div>
          ))}
        </section>

        <section className={TR_BOX}>
          <NetVisionCompanyMark
            company={rotulo.company}
            size={30}
            className="text-base font-bold uppercase tracking-[0.1em] text-[#f2f2f2]"
          />
        </section>
      </div>
    </article>
  )
}

/* ── Arcade: degradado azul-morado, títulos inclinados, fichas de color ── */

const ARCADE_SKEW: CSSProperties = { transform: 'skewX(-8deg)' }
const ARCADE_TILE =
  'flex min-w-[6.5rem] flex-col justify-center rounded-lg px-4 py-2 leading-none'

function SheetArcade({ payload, livePlano }: SheetProps) {
  const { rotulo } = payload
  return (
    <article
      className="nv-print-sheet flex flex-col p-4 text-white print:p-[7mm]"
      style={{
        background: 'linear-gradient(180deg, #1c4fe0 0%, #5b2bd6 70%, #7a2bd3 100%)',
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1">
        <div className="min-w-0" style={ARCADE_SKEW}>
          <h1
            className="break-words text-5xl font-extrabold uppercase leading-[0.95] sm:text-6xl print:text-6xl"
            style={{ ...CONDENSED, textShadow: '0 5px 0 #0b1b5e' }}
          >
            {rotulo.projectName}
          </h1>
          {payload.planoNombre?.trim() ? (
            <p className="mt-1.5 truncate text-sm font-bold uppercase tracking-[0.1em]">
              {payload.planoNombre.trim()}
            </p>
          ) : null}
        </div>
        <span
          className="shrink-0 rounded-md bg-[#ffe81a] px-5 py-2 text-2xl font-extrabold uppercase leading-none text-[#101a4a] shadow-[0_5px_0_#b89b00]"
          style={{ ...CONDENSED, ...ARCADE_SKEW }}
        >
          Plano {rotulo.planType}
        </span>
      </header>

      <div className="nv-print-plano relative mt-4 overflow-hidden rounded-2xl border-4 border-white bg-[#05080d] shadow-[0_8px_0_rgba(8,16,70,0.5)]">
        <PlanoSlot
          payload={payload}
          livePlano={livePlano}
          emptyClass="text-white/80"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-stretch gap-3 px-2" style={CONDENSED}>
        {payload.cameraCount != null ? (
          <div
            className={`${ARCADE_TILE} text-[#101a4a] shadow-[0_5px_0_#9a6a00]`}
            style={{ ...ARCADE_SKEW, background: 'linear-gradient(180deg, #ffe81a, #ffb21a)' }}
          >
            <span className="text-4xl font-extrabold">{payload.cameraCount}</span>
            <span className="mt-1 text-[12px] font-bold uppercase tracking-[0.12em]">
              {plural(payload.cameraCount, 'Cámara', 'Cámaras')}
            </span>
          </div>
        ) : null}
        {payload.networkCount != null ? (
          <div
            className={`${ARCADE_TILE} shadow-[0_5px_0_#06318a]`}
            style={{ ...ARCADE_SKEW, background: 'linear-gradient(180deg, #22b8ff, #0a63d6)' }}
          >
            <span className="text-4xl font-extrabold">{payload.networkCount}</span>
            <span className="mt-1 text-[12px] font-bold uppercase tracking-[0.12em]">Red</span>
          </div>
        ) : null}
        {payload.structureCount != null ? (
          <div
            className={`${ARCADE_TILE} shadow-[0_5px_0_#3e0c7a]`}
            style={{ ...ARCADE_SKEW, background: 'linear-gradient(180deg, #c566ff, #7a1fd6)' }}
          >
            <span className="text-4xl font-extrabold">{payload.structureCount}</span>
            <span className="mt-1 text-[12px] font-bold uppercase tracking-[0.12em]">
              {plural(payload.structureCount, 'Estructura', 'Estructuras')}
            </span>
          </div>
        ) : null}
        <div
          className="flex min-w-[10rem] flex-1 flex-col justify-center rounded-lg bg-[rgba(8,16,70,0.6)] px-5 py-2"
          style={ARCADE_SKEW}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c9d4ff]">
            Fecha
          </span>
          <span className="mt-0.5 text-xl font-bold uppercase leading-tight">
            {rotulo.dateLabel}
          </span>
        </div>
        <NetVisionCompanyMark
          company={rotulo.company}
          size={36}
          className="self-center text-base font-bold uppercase tracking-[0.08em] text-white"
        />
      </div>
    </article>
  )
}

/** Hoja del plano para «Imprimir / PDF», según el tema elegido. */
export default function NetVisionPlanoPrintSheet({
  tema,
  ...props
}: SheetProps & { tema: PlanoPrintTema }) {
  if (tema === 'arcade') return <SheetArcade {...props} />
  if (tema === 'tiempo-real') return <SheetTiempoReal {...props} />
  return <SheetTactico {...props} />
}
