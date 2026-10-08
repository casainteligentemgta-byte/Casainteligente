'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Play, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import type { CandidatoContratoMasiva } from '@/lib/talento/candidatosContratoMasiva';

export type ResultadoCandidatoMasiva = {
  empleadoId: string;
  cedula: string;
  nombre: string;
  status: 'pendiente' | 'ok' | 'error';
  error?: string;
  id?: string;
  signedUrl?: string | null;
};

type Props = {
  proyectoId: string;
  fechaIngreso: string;
  jornada: string;
  horarioDefault: string;
  estadoCivilDefault: string;
  configNominaId: string;
  bonoUsd: number;
  onGenerados?: () => void;
};

export default function ContratacionMasivaCandidatos({
  proyectoId,
  fechaIngreso,
  jornada,
  horarioDefault,
  estadoCivilDefault,
  configNominaId,
  bonoUsd,
  onGenerados,
}: Props) {
  const [candidatos, setCandidatos] = useState<CandidatoContratoMasiva[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [generando, setGenerando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoCandidatoMasiva[]>([]);

  const listos = useMemo(() => candidatos.filter((c) => c.listo), [candidatos]);

  async function cargar() {
    if (!proyectoId.trim()) {
      setCandidatos([]);
      setSeleccion(new Set());
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/talento/contratos-masiva/candidatos?proyecto_id=${encodeURIComponent(proyectoId)}`),
        { credentials: 'include' },
      );
      const j = (await res.json()) as { candidatos?: CandidatoContratoMasiva[]; error?: string };
      if (!res.ok) {
        setCandidatos([]);
        setSeleccion(new Set());
        setError(j.error ?? `Error HTTP ${res.status}`);
        return;
      }
      const rows = j.candidatos ?? [];
      setCandidatos(rows);
      setSeleccion(new Set(rows.filter((c) => c.listo).map((c) => c.empleadoId)));
    } catch {
      setError('No se pudo cargar quienes respondieron el enlace.');
      setCandidatos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    setResultados([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar al cambiar obra
  }, [proyectoId]);

  function toggle(id: string, enabled: boolean) {
    if (!enabled) return;
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodosListos() {
    if (seleccion.size === listos.length) setSeleccion(new Set());
    else setSeleccion(new Set(listos.map((c) => c.empleadoId)));
  }

  async function generar() {
    const ids = candidatos.filter((c) => seleccion.has(c.empleadoId) && c.listo).map((c) => c.empleadoId);
    if (!proyectoId.trim()) {
      toast.error('Seleccione la obra');
      return;
    }
    if (ids.length === 0) {
      toast.error('Marque al menos un obrero que ya llenó el enlace');
      return;
    }
    if (!configNominaId.trim() && !candidatos.some((c) => seleccion.has(c.empleadoId) && c.cargo)) {
      toast.error('Seleccione un cargo por defecto o use obreros con oficio de la vacante');
      return;
    }

    setGenerando(true);
    setResultados(
      ids.map((id) => {
        const c = candidatos.find((x) => x.empleadoId === id)!;
        return { empleadoId: id, cedula: c.cedula, nombre: c.nombreCompleto, status: 'pendiente' };
      }),
    );
    try {
      const res = await fetch(apiUrl('/api/talento/contratos-masiva'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId.trim(),
          empleado_ids: ids,
          config_nomina_id: configNominaId.trim() || null,
          fecha_ingreso: fechaIngreso,
          jornada_trabajo: jornada,
          horario_semanal_texto: horarioDefault.trim() || null,
          bono_manual_usd: bonoUsd,
          estado_civil_default: estadoCivilDefault.trim() || 'Soltero',
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        generados?: number;
        fallidos?: number;
        resultados?: Array<{
          empleado_id: string;
          cedula: string;
          nombre: string;
          ok: boolean;
          id?: string;
          signed_url?: string | null;
          error?: string;
        }>;
      };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudieron generar los contratos');
        return;
      }
      setResultados(
        (j.resultados ?? []).map((r) => ({
          empleadoId: r.empleado_id,
          cedula: r.cedula,
          nombre: r.nombre,
          status: r.ok ? 'ok' : 'error',
          error: r.error,
          id: r.id,
          signedUrl: r.signed_url ?? null,
        })),
      );
      if ((j.fallidos ?? 0) === 0) toast.success(`${j.generados ?? ids.length} contrato(s) generados`);
      else toast.message(`Serie: ${j.generados ?? 0} ok, ${j.fallidos ?? 0} con error`);
      void cargar();
      onGenerados?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setGenerando(false);
    }
  }

  if (!proyectoId.trim()) {
    return <p className="text-sm text-zinc-500">Seleccione la obra para ver quiénes ya llenaron el enlace.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300/90">
            Quienes ya llenaron el enlace
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {loading
              ? 'Cargando…'
              : `${listos.length} listo(s) de ${candidatos.length}. Los datos del lote de arriba se copian a todos.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {listos.length > 0 ? (
            <button
              type="button"
              onClick={toggleTodosListos}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/10"
            >
              {seleccion.size === listos.length ? 'Quitar todos' : 'Marcar listos'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
          {error}
        </p>
      ) : null}

      {loading && candidatos.length === 0 ? (
        <p className="text-sm text-zinc-500">Buscando hojas de vida de esta obra…</p>
      ) : candidatos.length === 0 && !error ? (
        <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-4 text-sm text-zinc-400">
          Nadie de esta obra ha llenado el enlace todavía. Envíe el link de la solicitud o use el
          rescate Excel abajo.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-black/30">
          {candidatos.map((c) => {
            const disabled = !c.listo || generando;
            const checked = seleccion.has(c.empleadoId);
            return (
              <li key={c.empleadoId}>
                <label
                  className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 ${
                    disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-emerald-500"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(c.empleadoId, !disabled)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-100">
                      {c.nombreCompleto || 'Sin nombre'}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                      {c.cedula || 'sin cédula'}
                      {c.cargo ? ` · ${c.cargo}` : ''}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                        HV
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 ${
                          c.evaluacionLista
                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                        }`}
                      >
                        {c.evaluacionLista ? `Eval ${c.semaforo ?? 'ok'}` : 'Eval pendiente'}
                      </span>
                      {c.yaContratado ? (
                        <span className="rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2 py-0.5 text-zinc-300">
                          Ya contratado
                        </span>
                      ) : null}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void generar()}
        disabled={generando || seleccion.size === 0 || !proyectoId}
        className="inline-flex w-full min-h-[2.75rem] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black uppercase tracking-wide text-black hover:bg-amber-400 disabled:opacity-50"
      >
        {generando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando…
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Generar {seleccion.size || ''} contrato{seleccion.size === 1 ? '' : 's'}
          </>
        )}
      </button>

      {resultados.length > 0 ? (
        <ul className="space-y-2">
          {resultados.map((r) => (
            <li
              key={r.empleadoId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-200">{r.nombre}</p>
                <p className="font-mono text-zinc-500">{r.cedula}</p>
                {r.error ? <p className="mt-0.5 text-red-400">{r.error}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.status === 'ok' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    {r.signedUrl ? (
                      <a
                        href={r.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-300 underline underline-offset-2 hover:text-amber-200"
                      >
                        PDF
                      </a>
                    ) : null}
                  </>
                ) : r.status === 'error' ? (
                  <XCircle className="h-4 w-4 text-red-400" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
