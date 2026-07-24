'use client';

import React from 'react';
import { fmtMontoLulo } from '@/lib/proyectos/presupuestoCapitulosFormat';
import {
  MEMBRETE_REPRESENTANTE_LEGAL,
  type ResumenPresupuestoTablaProps,
} from '@/lib/proyectos/resumenPresupuestoMembrete';

/** Tabla + membrete compartidos (iPad: table-fixed + scroll táctil). */
export function ResumenPresupuestoShell({
  tituloDocumento,
  proyectoNombre,
  numeroContrato,
  propietarioObra,
  capitulos,
  totalGeneral,
  pagina = 1,
  className = '',
}: ResumenPresupuestoTablaProps) {
  const fechaActual = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <article
      className={`w-full max-w-5xl mx-auto bg-[#0A0A0F] text-zinc-200 border border-white/10 rounded-xl p-6 md:p-8 font-sans shadow-2xl print:shadow-none print:border-slate-300 ${className}`.trim()}
      aria-label={`${tituloDocumento}: ${proyectoNombre}`}
    >
      <header className="flex flex-col md:flex-row justify-between items-start border-b border-white/10 pb-4 mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white">
            {MEMBRETE_REPRESENTANTE_LEGAL.nombre}
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            {MEMBRETE_REPRESENTANTE_LEGAL.cargo} | C.I.: {MEMBRETE_REPRESENTANTE_LEGAL.cedula}
          </p>
          <p className="text-sm font-semibold tracking-wider text-emerald-400 mt-2 uppercase border-b border-emerald-500/30 inline-block">
            {tituloDocumento}
          </p>
        </div>
        <div className="text-right text-xs font-mono text-zinc-400 space-y-1 shrink-0">
          <div>
            <span className="text-zinc-500">Pág Nº:</span> {pagina}
          </div>
          <div>
            <span className="text-zinc-500">Fecha:</span> {fechaActual}
          </div>
        </div>
      </header>

      <section className="bg-white/[0.02] border border-white/5 rounded-lg p-4 mb-6 space-y-2 text-xs md:text-sm">
        <div>
          <span className="font-bold text-zinc-400 uppercase tracking-wider text-[11px] block">
            Obra:
          </span>
          <span className="text-white font-medium">{proyectoNombre}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <span className="font-bold text-zinc-400 uppercase tracking-wider text-[11px] block">
              Contrato Nº:
            </span>
            <span className="text-zinc-300 font-mono">{numeroContrato || 'E.S/C'}</span>
          </div>
          <div>
            <span className="font-bold text-zinc-400 uppercase tracking-wider text-[11px] block">
              Propietario:
            </span>
            <span className="text-zinc-300">{propietarioObra}</span>
          </div>
        </div>
      </section>

      <div
        className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] touch-pan-x"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <table className="w-full min-w-[750px] table-fixed border-collapse">
          <colgroup>
            <col style={{ width: '45%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-white/10 text-zinc-400 text-xs font-bold uppercase tracking-wider bg-white/[0.01]">
              <th className="p-3 text-left">Capítulos / Sub Capítulos</th>
              <th className="p-3 text-right">Totales Sub-Capítulos</th>
              <th className="p-3 text-right">Totales Capítulos</th>
              <th className="p-3 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs md:text-sm">
            {capitulos.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-zinc-500">
                  No hay partidas para el presupuesto.
                </td>
              </tr>
            ) : (
              capitulos.map((cap) => (
                <React.Fragment key={cap.titulo}>
                  <tr className="bg-white/[0.02] font-bold text-white">
                    <td className="p-3 uppercase tracking-wide break-words">{cap.titulo}</td>
                    <td className="p-3 text-right text-zinc-500">—</td>
                    <td className="p-3 text-right font-mono text-emerald-400 tabular-nums whitespace-nowrap">
                      {fmtMontoLulo(cap.totalCapitulo)}
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-400 tabular-nums whitespace-nowrap">
                      {cap.porcentaje.toFixed(2)}%
                    </td>
                  </tr>
                  {cap.subCapitulos.map((sub) => (
                    <tr
                      key={`${cap.titulo}-${sub.titulo}`}
                      className="text-zinc-300 hover:bg-white/[0.01] transition-colors"
                    >
                      <td className="p-3 pl-8 text-zinc-400 italic break-words">{sub.titulo}</td>
                      <td className="p-3 text-right font-mono text-zinc-400 tabular-nums whitespace-nowrap">
                        {fmtMontoLulo(sub.totalSub)}
                      </td>
                      <td className="p-3 text-right text-zinc-600">—</td>
                      <td className="p-3 text-right text-zinc-600">—</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {capitulos.length > 0 ? (
        <footer className="mt-4 border-t-2 border-white/10 pt-4 flex justify-end items-center gap-6">
          <span className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Total US$:
          </span>
          <span className="text-xl font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-lg tabular-nums whitespace-nowrap">
            {fmtMontoLulo(totalGeneral)}
          </span>
        </footer>
      ) : null}
    </article>
  );
}
