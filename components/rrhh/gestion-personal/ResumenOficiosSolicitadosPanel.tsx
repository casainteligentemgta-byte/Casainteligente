'use client';

import { ResumenSolicitadosOficiosToolbar } from '@/components/rrhh/gestion-personal/ResumenSolicitadosOficiosToolbar';

export type ResumenOficioRow = {
  codigo: string;
  nombre: string | null;
  plazas: number;
  solicitudes: number;
};

type Props = {
  soloPendientes: boolean;
  totalPlazasPendientes: number;
  pendingCount: number;
  resumenOficiosSolicitados: ResumenOficioRow[];
  proyectoModuloFiltro: string;
  proyectoObraFiltro: string;
  proyectoModuloIdsFiltro: string[];
  entidadFiltro: string;
  alcanceTodosProyectos: boolean;
  alcanceNombre: string | null;
};

/** Tabla resumen de plazas pendientes agrupadas por oficio. */
export default function ResumenOficiosSolicitadosPanel({
  soloPendientes,
  totalPlazasPendientes,
  pendingCount,
  resumenOficiosSolicitados,
  proyectoModuloFiltro,
  proyectoObraFiltro,
  proyectoModuloIdsFiltro,
  entidadFiltro,
  alcanceTodosProyectos,
  alcanceNombre,
}: Props) {
  if (resumenOficiosSolicitados.length === 0) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-violet-500/35 bg-violet-950/25">
      <div
        className={`border-b border-violet-500/25 ${soloPendientes ? 'px-3 py-2 sm:px-4' : 'px-4 py-3 sm:px-5'}`}
      >
        <div
          className={
            soloPendientes
              ? 'flex justify-end'
              : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
          }
        >
          {!soloPendientes ? (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-violet-200">
                Resumen por oficio
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                {totalPlazasPendientes} plaza(s) en {pendingCount} solicitud(es) pendiente(s)
              </p>
            </div>
          ) : null}
          <ResumenSolicitadosOficiosToolbar
            proyectoModuloId={proyectoModuloFiltro || undefined}
            proyectoObraId={proyectoObraFiltro || undefined}
            proyectoModuloIds={
              proyectoModuloIdsFiltro.length > 1 ? proyectoModuloIdsFiltro : undefined
            }
            entidadId={entidadFiltro || undefined}
            todosLosProyectos={alcanceTodosProyectos}
            alcanceNombre={alcanceNombre}
            iconsOnly={soloPendientes}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2.5 sm:px-5">Plazas · oficio (tabulador)</th>
              <th className="px-4 py-2.5 text-right sm:pr-5">Solicitudes</th>
            </tr>
          </thead>
          <tbody>
            {resumenOficiosSolicitados.map((row) => (
              <tr key={row.codigo} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 sm:px-5">
                  <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-snug">
                    <span className="tabular-nums font-bold text-white">{row.plazas}</span>
                    <span className="text-zinc-600" aria-hidden>
                      ·
                    </span>
                    <span className="font-mono font-semibold text-violet-100">{row.codigo}</span>
                    {row.nombre ? <span className="text-zinc-400">— {row.nombre}</span> : null}
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-300 sm:pr-5">
                  {row.solicitudes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
