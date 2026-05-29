'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import { useAvanceCampoManager } from '@/hooks/useAvanceCampoManager';
import type { CronogramaCapitulo } from '@/types/cronograma';
import { cn } from '@/lib/utils';

type Props = {
  proyectoId: string;
  capitulos: CronogramaCapitulo[];
  loading?: boolean;
  onSaved?: () => void;
};

type AvanceLocal = {
  id: string;
  partida_id: string | null;
  codigo_partida: string | null;
  nombre_tarea: string;
  porcentaje_avance: number;
  fecha_inicio_planificada: string;
  fecha_fin_planificada: string;
  orden?: number;
};

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

function avanceCapitulo(partidas: AvanceLocal[]): number {
  if (!partidas.length) return 0;
  return partidas.reduce((s, p) => s + p.porcentaje_avance, 0) / partidas.length;
}

export default function CronogramaAvanceDiarioPanel({
  proyectoId,
  capitulos,
  loading = false,
  onSaved,
}: Props) {
  const { isSubmitting: isSubmittingLock, runLocked } = useSyncSubmitLock();
  const {
    registrarAvanceFisico,
    isSubmitting: isSubmittingAvance,
    tienePendientesOffline,
    sincronizando,
  } = useAvanceCampoManager(proyectoId, { onSynced: onSaved });
  const isSubmitting = isSubmittingLock || isSubmittingAvance;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [avances, setAvances] = useState<Map<string, AvanceLocal>>(new Map());
  const [dirty, setDirty] = useState(false);

  const partidasIniciales = useMemo(() => {
    const map = new Map<string, AvanceLocal>();
    for (const cap of capitulos) {
      for (const p of cap.partidas) {
        if (p.partida_id || p.id) {
          const key = p.partida_id ?? p.id;
          map.set(key, {
            id: p.id,
            partida_id: p.partida_id,
            codigo_partida: p.codigo_partida,
            nombre_tarea: p.nombre_tarea,
            porcentaje_avance: Number(p.porcentaje_avance) || 0,
            fecha_inicio_planificada: p.fecha_inicio_planificada,
            fecha_fin_planificada: p.fecha_fin_planificada,
            orden: p.orden,
          });
        }
      }
    }
    return map;
  }, [capitulos]);

  useEffect(() => {
    setAvances(new Map(partidasIniciales));
    setDirty(false);
    if (capitulos.length && expanded.size === 0) {
      setExpanded(new Set(capitulos.slice(0, 2).map((c) => c.id)));
    }
  }, [partidasIniciales, capitulos]);

  const toggleCap = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const patchAvance = useCallback((key: string, pct: number) => {
    setAvances((prev) => {
      const row = prev.get(key);
      if (!row) return prev;
      const next = new Map(prev);
      next.set(key, { ...row, porcentaje_avance: clampPct(pct) });
      return next;
    });
    setDirty(true);
  }, []);

  const incrementar = (key: string, delta: number) => {
    const row = avances.get(key);
    if (!row) return;
    patchAvance(key, row.porcentaje_avance + delta);
  };

  const guardar = () => {
    void runLocked(async () => {
      const actualizaciones = Array.from(avances.values()).map((a) => ({
        id: a.id.startsWith('borrador-') ? undefined : a.id,
        partida_id: a.partida_id,
        codigo_partida: a.codigo_partida,
        nombre_tarea: a.nombre_tarea,
        porcentaje_avance: a.porcentaje_avance,
        fecha_inicio_planificada: a.fecha_inicio_planificada,
        fecha_fin_planificada: a.fecha_fin_planificada,
        orden: a.orden,
      }));

      const resultado = await registrarAvanceFisico(actualizaciones);
      if ('success' in resultado && resultado.success) {
        setDirty(false);
      } else if ('offline' in resultado && resultado.offline) {
        setDirty(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0A0A0F] py-16 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Cargando partidas…
      </div>
    );
  }

  if (!capitulos.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-8 text-center text-sm text-zinc-500">
        Sin partidas en el presupuesto. Importe Lulo para registrar avance diario.
      </p>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {tienePendientesOffline ? (
        <div
          className={cn(
            'mb-4 flex w-full select-none flex-col items-start justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 backdrop-blur-xl sm:flex-row sm:items-center',
            !sincronizando && 'animate-pulse',
          )}
          role="status"
        >
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-mono text-xs uppercase tracking-wider text-amber-400">
              {sincronizando
                ? 'Sincronizando reportes de campo con Supabase…'
                : 'Frente de obra operando en modo Offline'}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase text-zinc-500">
            {sincronizando
              ? 'Enviando cola local al servidor central'
              : 'Se guardará localmente hasta detectar señal Movistar/Digitel'}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-xs text-zinc-400 max-w-xl">
          Registro táctil de avance físico del día. Si la partida no tiene tareas en cronograma, el porcentaje
          se guarda directamente sobre la partida (anti-embudo).
        </p>
        <Button
          type="button"
          variant="elitePrimary"
          disabled={isSubmitting || !dirty}
          onClick={() => void guardar()}
          className="select-none touch-manipulation"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="mr-2 h-4 w-4" aria-hidden />
          )}
          {isSubmitting ? 'Guardando…' : 'Confirmar Avance'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0F]">
        {capitulos.map((cap) => {
          const abierto = expanded.has(cap.id);
          const partidasCap = cap.partidas
            .map((p) => {
              const key = p.partida_id ?? p.id;
              return avances.get(key) ?? null;
            })
            .filter((x): x is AvanceLocal => x !== null);
          const pctCap = avanceCapitulo(partidasCap);

          return (
            <div key={cap.id} className="border-b border-white/10 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleCap(cap.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] touch-manipulation"
              >
                {abierto ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-100">
                    {cap.codigo ? `${cap.codigo} · ` : ''}
                    {cap.nombre}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all"
                      style={{ width: `${pctCap}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400">
                  {pctCap.toFixed(0)}%
                </span>
              </button>

              {abierto ? (
                <div className="space-y-1 border-t border-white/5 bg-black/20 px-3 py-2 pb-3">
                  {cap.partidas.map((p) => {
                    const key = p.partida_id ?? p.id;
                    const row = avances.get(key);
                    if (!row) return null;
                    const pct = row.porcentaje_avance;
                    const desc = p.descripcion_partida ?? p.nombre_tarea;

                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 sm:px-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs font-bold text-sky-400/90">
                              {row.codigo_partida ?? '—'}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-sm text-zinc-300">{desc}</p>
                          </div>
                          <span className="font-mono text-lg font-bold tabular-nums text-emerald-400">
                            {pct.toFixed(0)}%
                          </span>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-emerald-500/80 transition-all duration-150"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={pct}
                            onChange={(e) => patchAvance(key, Number(e.target.value))}
                            className={cn(
                              'h-10 w-full flex-1 cursor-pointer accent-emerald-500 touch-manipulation',
                              'select-none',
                            )}
                            aria-label={`Avance ${row.codigo_partida ?? desc}`}
                          />
                          <div className="flex shrink-0 gap-1.5">
                            {[10, 25, 50].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => incrementar(key, d)}
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/[0.08] touch-manipulation select-none"
                              >
                                +{d}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
