'use client';

import { useMemo, useState } from 'react';
import { CalendarRange, ChevronRight, Loader2 } from 'lucide-react';
import type { CronogramaEscala, CronogramaTarea } from '@/types/cronograma';
import {
  buildTimelineColumns,
  calcularBarraGantt,
  COLORES_BARRA,
  formatFechaCorta,
  parseFechaPlan,
  rangoProyectoTareas,
} from '@/lib/proyectos/cronogramaGanttLayout';
import { cn } from '@/lib/utils';

export type CronogramaGanttProps = {
  tareas: CronogramaTarea[];
  loading?: boolean;
  escalaInicial?: CronogramaEscala;
  onTareaClick?: (tarea: CronogramaTarea) => void;
  className?: string;
};

const LABEL_W = 'min-w-[14rem] w-[14rem] max-w-[14rem]';

function ordenarTareas(tareas: CronogramaTarea[]): CronogramaTarea[] {
  return [...tareas].sort((a, b) => {
    const oa = a.orden ?? 0;
    const ob = b.orden ?? 0;
    if (oa !== ob) return oa - ob;
    return (
      parseFechaPlan(a.fecha_inicio_planificada).getTime() -
      parseFechaPlan(b.fecha_inicio_planificada).getTime()
    );
  });
}

export default function CronogramaGantt({
  tareas,
  loading = false,
  escalaInicial = 'semana',
  onTareaClick,
  className,
}: CronogramaGanttProps) {
  const [escala, setEscala] = useState<CronogramaEscala>(escalaInicial);
  const ordenadas = useMemo(() => ordenarTareas(tareas), [tareas]);

  const { timelineInicio, timelineFin, columnas } = useMemo(() => {
    const { inicio, fin } = rangoProyectoTareas(ordenadas);
    return {
      timelineInicio: inicio,
      timelineFin: fin,
      columnas: buildTimelineColumns(inicio, fin, escala),
    };
  }, [ordenadas, escala]);

  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const hoyPct = useMemo(() => {
    const totalMs = timelineFin.getTime() - timelineInicio.getTime();
    if (totalMs <= 0) return null;
    const pos = hoy.getTime() - timelineInicio.getTime();
    if (pos < 0 || pos > totalMs) return null;
    return (pos / totalMs) * 100;
  }, [hoy, timelineInicio, timelineFin]);

  const timelineMinW = Math.max(columnas.length * (escala === 'semana' ? 76 : 92), 520);

  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-800/90 bg-[#0c0d12] shadow-xl overflow-hidden',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-sky-400" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Cronograma de obra</h2>
            <p className="text-[11px] text-zinc-500">
              {ordenadas.length} actividades · barras planificadas y avance real
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-zinc-700 p-0.5 text-[11px] font-semibold">
          {(['semana', 'mes'] as const).map((e) => (
            <button
              key={e}
              type="button"
              className={cn(
                'rounded-md px-3 py-1.5',
                escala === e ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
              )}
              onClick={() => setEscala(e)}
            >
              {e === 'semana' ? 'Semanas' : 'Meses'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap gap-3 px-4 py-2 border-b border-zinc-800/80 text-[10px] text-zinc-400">
        <LegendItem className="bg-sky-500/30 border border-sky-500/40 w-6 h-2.5" label="Planificado" />
        <LegendItem className="bg-emerald-500/85 w-4 h-2.5" label="A tiempo" />
        <LegendItem className="bg-amber-500/80 w-4 h-2.5" label="En riesgo" />
        <LegendItem className="bg-rose-600/90 w-4 h-2.5" label="Atrasada" />
        <span className="inline-flex items-center gap-1">
          <span className="w-px h-3 bg-rose-400" /> Hoy
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center gap-2 py-20 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
          Cargando cronograma…
        </div>
      ) : ordenadas.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-zinc-500">
          Sin tareas. Registra actividades en el cronograma vinculadas a partidas del presupuesto.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex border-b border-zinc-800 bg-zinc-900/70 min-w-max">
            <div
              className={cn(
                LABEL_W,
                'shrink-0 sticky left-0 z-20 px-3 py-2 text-[10px] font-bold uppercase text-zinc-500 border-r border-zinc-800 bg-zinc-900',
              )}
            >
              Actividad
            </div>
            <div
              className="grid shrink-0"
              style={{
                minWidth: timelineMinW,
                gridTemplateColumns: `repeat(${columnas.length}, minmax(4.5rem, 1fr))`,
              }}
            >
              {columnas.map((c) => (
                <div
                  key={c.key}
                  className="px-1 py-2 text-center text-[10px] font-semibold text-zinc-400 border-r border-zinc-800/50"
                >
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          {ordenadas.map((tarea) => {
            const barra = calcularBarraGantt(tarea, timelineInicio, timelineFin, hoy);
            const colores = COLORES_BARRA[barra.estado];
            const clickable = Boolean(onTareaClick);

            return (
              <div
                key={tarea.id}
                className="flex border-b border-zinc-800/50 hover:bg-zinc-900/30 min-w-max"
              >
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => onTareaClick?.(tarea)}
                  className={cn(
                    LABEL_W,
                    'shrink-0 sticky left-0 z-10 flex flex-col gap-0.5 px-3 py-2.5 text-left border-r border-zinc-800 bg-[#0c0d12]',
                    clickable && 'hover:bg-zinc-800/50 cursor-pointer group',
                  )}
                >
                  <span className="text-xs font-semibold text-zinc-100 line-clamp-2">
                    {tarea.nombre_tarea}
                  </span>
                  {tarea.codigo_partida ? (
                    <span className="font-mono text-[10px] text-sky-400">{tarea.codigo_partida}</span>
                  ) : null}
                  <span className="text-[10px] text-zinc-500">
                    {formatFechaCorta(parseFechaPlan(tarea.fecha_inicio_planificada))} –{' '}
                    {formatFechaCorta(parseFechaPlan(tarea.fecha_fin_planificada))}
                  </span>
                  <span className="text-[10px] text-zinc-400">{barra.avance.toFixed(0)}% avance</span>
                  {clickable ? (
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-sky-400" />
                  ) : null}
                </button>

                <div
                  className="relative shrink-0 h-14"
                  style={{
                    minWidth: timelineMinW,
                    width: timelineMinW,
                  }}
                >
                  <div
                    className="absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${columnas.length}, minmax(4.5rem, 1fr))`,
                    }}
                  >
                    {columnas.map((c) => (
                      <div key={c.key} className="border-r border-zinc-800/25 h-full" />
                    ))}
                  </div>

                  {hoyPct != null ? (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-rose-400/75 z-[1]"
                      style={{ left: `${hoyPct}%` }}
                    />
                  ) : null}

                  <div className="absolute inset-0 flex items-center px-0.5 z-[2] pointer-events-none">
                    <div
                      className={cn('absolute h-5 rounded-md border', colores.plan)}
                      style={{ left: `${barra.leftPct}%`, width: `${barra.widthPct}%` }}
                    />
                    <div
                      className={cn('absolute h-3.5 rounded-sm border', colores.prog, colores.borde)}
                      style={{
                        left: `${barra.leftPct}%`,
                        width: `${Math.max(barra.progressWidthPct, barra.avance > 0 ? 0.4 : 0)}%`,
                      }}
                    />
                  </div>

                  {clickable ? (
                    <button
                      type="button"
                      className="absolute inset-0 z-[3] cursor-pointer"
                      aria-label={`Detalle ${tarea.nombre_tarea}`}
                      onClick={() => onTareaClick?.(tarea)}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('rounded-sm', className)} />
      {label}
    </span>
  );
}
