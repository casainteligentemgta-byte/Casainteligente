'use client';

import { useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { resumirCapituloComoTarea } from '@/lib/proyectos/cronogramaCapitulos';
import type { CronogramaCapitulo, CronogramaEscala, CronogramaTarea } from '@/types/cronograma';
import {
  buildTimelineColumns,
  calcularBarraGantt,
  COLORES_BARRA,
  formatFechaCorta,
  parseFechaPlan,
  rangoProyectoTareas,
  type TimelineColumn,
} from '@/lib/proyectos/cronogramaGanttLayout';
import { cn } from '@/lib/utils';

export type CronogramaGanttProps = {
  tareas: CronogramaTarea[];
  capitulos?: CronogramaCapitulo[];
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
  capitulos = [],
  loading = false,
  escalaInicial = 'semana',
  onTareaClick,
  className,
}: CronogramaGanttProps) {
  const [escala, setEscala] = useState<CronogramaEscala>(escalaInicial);
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set());

  const usarCascada = capitulos.length > 0;
  const partidasPlano = useMemo(
    () => (usarCascada ? capitulos.flatMap((c) => c.partidas) : tareas),
    [usarCascada, capitulos, tareas],
  );
  const ordenadas = useMemo(() => ordenarTareas(partidasPlano), [partidasPlano]);

  const toggleCapitulo = (capId: string) => {
    setExpandedCaps((prev) => {
      const next = new Set(prev);
      if (next.has(capId)) next.delete(capId);
      else next.add(capId);
      return next;
    });
  };

  const expandirTodos = () => {
    setExpandedCaps(new Set(capitulos.map((c) => c.id)));
  };

  const colapsarTodos = () => setExpandedCaps(new Set());

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
              {usarCascada
                ? `${capitulos.length} capítulos · ${ordenadas.length} partidas`
                : `${ordenadas.length} actividades`}{' '}
              · barras planificadas y avance real
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {usarCascada ? (
            <div className="inline-flex rounded-lg border border-zinc-700 p-0.5 text-[10px] font-semibold">
              <button
                type="button"
                className="rounded-md px-2.5 py-1.5 text-zinc-400 hover:text-zinc-200"
                onClick={expandirTodos}
              >
                Expandir todo
              </button>
              <button
                type="button"
                className="rounded-md px-2.5 py-1.5 text-zinc-400 hover:text-zinc-200"
                onClick={colapsarTodos}
              >
                Colapsar
              </button>
            </div>
          ) : null}
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
      ) : ordenadas.length === 0 && !usarCascada ? (
        <p className="px-4 py-16 text-center text-sm text-zinc-500">
          Sin tareas. Importa el presupuesto Lulo o registra actividades en el cronograma.
        </p>
      ) : usarCascada ? (
        <div className="overflow-x-auto">
          <div className="flex border-b border-zinc-800 bg-zinc-900/70 min-w-max">
            <div
              className={cn(
                LABEL_W,
                'shrink-0 sticky left-0 z-20 px-3 py-2 text-[10px] font-bold uppercase text-zinc-500 border-r border-zinc-800 bg-zinc-900',
              )}
            >
              Capítulo / partida
            </div>
            <TimelineHeader columnas={columnas} timelineMinW={timelineMinW} />
          </div>

          {capitulos.map((cap) => {
            const expandido = expandedCaps.has(cap.id);
            const resumen = resumirCapituloComoTarea(
              cap.partidas[0]?.proyecto_id ?? tareas[0]?.proyecto_id ?? '',
              cap,
            );
            return (
              <div key={cap.id}>
                <GanttRow
                  tarea={resumen}
                  timelineInicio={timelineInicio}
                  timelineFin={timelineFin}
                  columnas={columnas}
                  timelineMinW={timelineMinW}
                  hoyPct={hoyPct}
                  hoy={hoy}
                  esCapitulo
                  expandido={expandido}
                  numPartidas={cap.partidas.length}
                  onToggle={() => toggleCapitulo(cap.id)}
                />
                {expandido
                  ? cap.partidas.map((partida, idx) => (
                      <GanttRow
                        key={partida.id}
                        tarea={partida}
                        timelineInicio={timelineInicio}
                        timelineFin={timelineFin}
                        columnas={columnas}
                        timelineMinW={timelineMinW}
                        hoyPct={hoyPct}
                        hoy={hoy}
                        indent
                        onTareaClick={onTareaClick}
                        rowKey={`${partida.id}-${idx}`}
                      />
                    ))
                  : null}
              </div>
            );
          })}
        </div>
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

          {ordenadas.map((tarea, idx) => (
            <GanttRow
              key={tarea.id}
              rowKey={`${tarea.id}-${idx}`}
              tarea={tarea}
              timelineInicio={timelineInicio}
              timelineFin={timelineFin}
              columnas={columnas}
              timelineMinW={timelineMinW}
              hoyPct={hoyPct}
              hoy={hoy}
              onTareaClick={onTareaClick}
            />
          ))}
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

function TimelineHeader({
  columnas,
  timelineMinW,
}: {
  columnas: TimelineColumn[];
  timelineMinW: number;
}) {
  return (
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
  );
}

type GanttRowProps = {
  tarea: CronogramaTarea;
  timelineInicio: Date;
  timelineFin: Date;
  columnas: TimelineColumn[];
  timelineMinW: number;
  hoyPct: number | null;
  hoy: Date;
  esCapitulo?: boolean;
  expandido?: boolean;
  numPartidas?: number;
  indent?: boolean;
  onToggle?: () => void;
  onTareaClick?: (tarea: CronogramaTarea) => void;
  rowKey?: string;
};

function GanttRow({
  tarea,
  timelineInicio,
  timelineFin,
  columnas,
  timelineMinW,
  hoyPct,
  hoy,
  esCapitulo = false,
  expandido = false,
  numPartidas = 0,
  indent = false,
  onToggle,
  onTareaClick,
}: GanttRowProps) {
  const barra = calcularBarraGantt(tarea, timelineInicio, timelineFin, hoy);
  const colores = COLORES_BARRA[barra.estado];
  const clickablePartida = Boolean(onTareaClick) && !esCapitulo;

  return (
    <div
      className={cn(
        'flex border-b border-zinc-800/50 min-w-max',
        esCapitulo ? 'bg-zinc-900/60 hover:bg-zinc-900/80' : 'hover:bg-zinc-900/30',
      )}
    >
      {esCapitulo ? (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            LABEL_W,
            'shrink-0 sticky left-0 z-10 flex items-start gap-2 px-3 py-2.5 text-left border-r border-zinc-800 bg-zinc-900/90 cursor-pointer group',
          )}
        >
          {expandido ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-sky-400 mt-0.5" />
          )}
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-400/90 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-zinc-100 line-clamp-2">
              {tarea.capitulo_codigo && tarea.capitulo_codigo !== '—'
                ? `${tarea.capitulo_codigo} · `
                : ''}
              {tarea.nombre_tarea}
            </span>
            <span className="text-[10px] text-zinc-500">
              {numPartidas} partida{numPartidas === 1 ? '' : 's'} ·{' '}
              {formatFechaCorta(parseFechaPlan(tarea.fecha_inicio_planificada))} –{' '}
              {formatFechaCorta(parseFechaPlan(tarea.fecha_fin_planificada))}
            </span>
            <span className="text-[10px] text-zinc-400">{barra.avance.toFixed(0)}% avance prom.</span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          disabled={!clickablePartida}
          onClick={() => onTareaClick?.(tarea)}
          className={cn(
            LABEL_W,
            'shrink-0 sticky left-0 z-10 flex flex-col gap-0.5 py-2.5 text-left border-r border-zinc-800 bg-[#0c0d12]',
            indent ? 'pl-10 pr-3' : 'px-3',
            clickablePartida && 'hover:bg-zinc-800/50 cursor-pointer group',
          )}
        >
          <span
            className={cn(
              'text-xs font-medium line-clamp-2',
              indent ? 'text-zinc-300' : 'text-zinc-100 font-semibold',
            )}
          >
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
          {clickablePartida ? (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-sky-400" />
          ) : null}
        </button>
      )}

      <div
        className="relative shrink-0 h-14"
        style={{ minWidth: timelineMinW, width: timelineMinW }}
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
            className={cn(
              'absolute rounded-md border',
              esCapitulo ? 'h-6 border-violet-500/40 bg-violet-500/15' : 'h-5',
              !esCapitulo && colores.plan,
            )}
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

        {clickablePartida ? (
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
}
