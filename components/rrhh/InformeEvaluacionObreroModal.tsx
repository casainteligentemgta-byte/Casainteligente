'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  armarInformeEvaluacionUnificada,
  type InformeEvaluacionArmado,
  type ItemInformeRespuesta,
} from '@/lib/rrhh/informeEvaluacionUnificada';

type Props = {
  open: boolean;
  empleadoId: string | null;
  nombre?: string | null;
  onClose: () => void;
  footer?: ReactNode;
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function grupoItems(items: ItemInformeRespuesta[]): [string, ItemInformeRespuesta[]][] {
  const order: string[] = [];
  const map = new Map<string, ItemInformeRespuesta[]>();
  for (const it of items) {
    if (!map.has(it.seccion)) {
      map.set(it.seccion, []);
      order.push(it.seccion);
    }
    map.get(it.seccion)!.push(it);
  }
  return order.map((k) => [k, map.get(k)!]);
}

export default function InformeEvaluacionObreroModal({
  open,
  empleadoId,
  nombre,
  onClose,
  footer,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [informe, setInforme] = useState<InformeEvaluacionArmado | null>(null);
  const [nombreFila, setNombreFila] = useState('');

  const cargar = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const cols =
      'id,nombre_completo,cedula,documento,rol_examen,cargo_nombre,cargo_codigo,rol_buscado,semaforo,status_evaluacion,motivo_semaforo,perfil_color,color_disc,puntaje_total,puntaje_personalidad,puntaje_logica,puntuacion_logica,puntuacion_confiabilidad,respuestas_personalidad,evaluacion_obrero_respuestas,examen_completado_at';
    let res = await supabase.from('ci_empleados').select(cols).eq('id', id).maybeSingle();
    if (res.error && /column|42703|schema cache/i.test(res.error.message)) {
      res = await supabase
        .from('ci_empleados')
        .select(
          'id,nombre_completo,cedula,documento,rol_examen,cargo_nombre,semaforo,status_evaluacion,motivo_semaforo,perfil_color,puntaje_total,puntaje_personalidad,respuestas_personalidad,examen_completado_at',
        )
        .eq('id', id)
        .maybeSingle();
    }
    if (res.error || !res.data) {
      setError(res.error?.message ?? 'Expediente no encontrado');
      setInforme(null);
      setLoading(false);
      return;
    }
    const e = res.data as Record<string, unknown>;
    setNombreFila(String(e.nombre_completo ?? '').trim());
    setInforme(
      armarInformeEvaluacionUnificada({
        evaluacionRaw: e.evaluacion_obrero_respuestas,
        respuestasPersonalidad: e.respuestas_personalidad,
        cargo: String(e.rol_buscado ?? e.cargo_nombre ?? ''),
        codigoGoE: String(e.cargo_codigo ?? ''),
        rolExamen: String(e.rol_examen ?? 'obrero'),
        semaforo: (e.semaforo as string | null) ?? null,
        motivoSemaforo: (e.motivo_semaforo as string | null) ?? null,
        perfilColor: (e.perfil_color as string | null) ?? (e.color_disc as string | null) ?? null,
        puntajeTotal: num(e.puntaje_total),
        puntajePersonalidad: num(e.puntaje_personalidad),
        puntuacionLogica: num(e.puntuacion_logica) ?? num(e.puntaje_logica),
        puntuacionConfiabilidad: num(e.puntuacion_confiabilidad),
        statusEvaluacion: (e.status_evaluacion as string | null) ?? null,
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open || !empleadoId) {
      setInforme(null);
      setError(null);
      return;
    }
    void cargar(empleadoId);
  }, [open, empleadoId, cargar]);

  if (!open) return null;

  const r = informe?.resultado;
  const sem = (r?.semaforo ?? '').toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-0 sm:items-center sm:px-4">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-gradient-to-br from-[#0F1117] via-[#101522] to-[#0A0A0F] shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Informe de evaluación</h2>
            <p className="mt-1 text-sm text-zinc-300">
              {(nombre ?? '').trim() || nombreFila || 'Sin nombre'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando test…
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</p>
          ) : null}

          {informe && !loading ? (
            <div className="space-y-6">
              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Resultado que arroja el test
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span
                    className={`rounded-full border px-2.5 py-1 ${
                      sem === 'verde'
                        ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                        : sem === 'amarillo'
                          ? 'border-amber-400/40 bg-amber-500/20 text-amber-200'
                          : sem === 'rojo'
                            ? 'border-rose-400/40 bg-rose-500/20 text-rose-200'
                            : 'border-white/20 bg-white/5 text-zinc-300'
                    }`}
                  >
                    Semáforo {r?.semaforo ?? '—'}
                  </span>
                  <span className="rounded-full border border-sky-400/35 bg-sky-500/20 px-2.5 py-1 text-sky-200">
                    DISC {r?.perfilColor ?? '—'}
                  </span>
                  {r?.etiquetaBanco ? (
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-zinc-200">
                      {r.etiquetaBanco}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Puntaje total</p>
                    <p className="mt-1 text-lg font-black text-white">
                      {r?.puntajeTotal != null ? r.puntajeTotal.toFixed(1) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Lógica</p>
                    <p className="mt-1 text-lg font-black text-cyan-200">
                      {r?.puntuacionLogica != null ? r.puntuacionLogica.toFixed(1) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">ABC</p>
                    <p className="mt-1 text-lg font-black text-fuchsia-200">
                      {r?.puntajePersonalidad != null ? r.puntajePersonalidad.toFixed(1) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Confiabilidad</p>
                    <p className="mt-1 text-lg font-black text-emerald-200">
                      {r?.puntuacionConfiabilidad != null ? r.puntuacionConfiabilidad.toFixed(1) : '—'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-zinc-300">
                  Evaluación: <span className="font-semibold text-white">{r?.estado ?? '—'}</span>
                  {r?.motivo ? <span className="block mt-1 text-zinc-400">{r.motivo}</span> : null}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  ABC: {r?.abcA ?? 0} A · {r?.abcB ?? 0} B · {r?.abcC ?? 0} C
                </p>
              </section>

              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Respuestas del obrero
                </p>
                {informe.items.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">No hay respuestas guardadas de este test.</p>
                ) : (
                  <div className="mt-3 space-y-4">
                    {grupoItems(informe.items).map(([seccion, rows]) => (
                      <div key={seccion}>
                        <h3 className="text-sm font-bold text-zinc-100">{seccion}</h3>
                        <ol className="mt-2 space-y-2">
                          {rows.map((it, i) => (
                            <li
                              key={it.id}
                              className={`rounded-xl border px-3 py-2.5 ${
                                it.ok === false
                                  ? 'border-rose-500/30 bg-rose-950/20'
                                  : it.ok === true
                                    ? 'border-emerald-500/25 bg-emerald-950/15'
                                    : 'border-white/10 bg-black/25'
                              }`}
                            >
                              <p className="text-sm text-zinc-100">
                                {i + 1}. {it.pregunta}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-amber-100">
                                Respondió: {it.respondio}
                              </p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3">
          {footer}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
