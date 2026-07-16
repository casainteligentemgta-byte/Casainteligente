'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, FileSearch, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  construirDetalleDesdeFilas,
  etiquetaFrecuenciaPersonalidad,
  preguntasParaDetalle,
  type DetalleRespuestasExamen,
} from '@/lib/rrhh/parseRespuestasExamen';
import { esPreguntaSituacionalObra, etiquetaRolExamenUI } from '@/lib/talento/exam';

type Props = {
  open: boolean;
  onClose: () => void;
  empleadoId: string | null;
};

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function DetalleRespuestasExamenModal({ open, onClose, empleadoId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleRespuestasExamen | null>(null);

  const cargar = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const colsEmp =
      'id,nombre_completo,cedula,documento,rol_examen,respuestas_personalidad,respuestas_logica,puntaje_personalidad,puntaje_logica,puntaje_total,semaforo,status_evaluacion,motivo_semaforo,perfil_color,color_disc,gma_0_5,nivel_integridad_riesgo,completo_en_tiempo,examen_inicio_at,examen_completado_at';

    let empRes = await supabase.from('ci_empleados').select(colsEmp).eq('id', id).maybeSingle();
    if (empRes.error && /column|42703|schema cache/i.test(empRes.error.message)) {
      empRes = await supabase
        .from('ci_empleados')
        .select(
          'id,nombre_completo,cedula,documento,rol_examen,puntaje_total,puntaje_logica,puntaje_personalidad,semaforo,status_evaluacion,examen_completado_at',
        )
        .eq('id', id)
        .maybeSingle();
    }

    if (empRes.error || !empRes.data) {
      setError(empRes.error?.message ?? 'Expediente no encontrado');
      setDetalle(null);
      setLoading(false);
      return;
    }

    const invRes = await supabase
      .from('ci_examenes')
      .select('id,token,expira_at,usado_at,fin_at,completado,respuestas_json,created_at')
      .eq('empleado_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    const invRow =
      !invRes.error && invRes.data?.length
        ? (invRes.data[0] as Record<string, unknown>)
        : null;

    setDetalle(
      construirDetalleDesdeFilas({
        empleado: empRes.data as Record<string, unknown>,
        examenInv: invRow,
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open || !empleadoId) {
      setDetalle(null);
      setError(null);
      return;
    }
    void cargar(empleadoId);
  }, [open, empleadoId, cargar]);

  if (!open) return null;

  const preguntas = detalle ? preguntasParaDetalle(detalle.rolExamen) : null;
  const sinRespuestas =
    detalle &&
    Object.keys(detalle.respuestasPersonalidad).length === 0 &&
    Object.keys(detalle.respuestasLogica).length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-violet-500/25 bg-zinc-950 shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-examen-titulo"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id="detalle-examen-titulo" className="flex items-center gap-2 text-lg font-bold text-white">
              <FileSearch className="h-5 w-5 text-violet-300" aria-hidden />
              Detalle de respuestas
            </h2>
            {detalle ? (
              <p className="mt-1 truncate text-sm text-zinc-400">
                {detalle.nombre} · {detalle.cedula}
              </p>
            ) : null}
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
          {loading ? <p className="text-sm text-zinc-500">Cargando respuestas…</p> : null}
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</p>
          ) : null}

          {detalle && !loading ? (
            <div className="space-y-6">
              {detalle.esParcial ? (
                <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Evaluación parcial (p. ej. tiempo agotado). Respuestas desde invitación{' '}
                  {detalle.cerradoEn ? `· ${fechaCorta(detalle.cerradoEn)}` : ''}.
                </p>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { k: 'Puntaje total', v: detalle.puntajeTotal?.toFixed(1) ?? '—' },
                  { k: 'Personalidad', v: detalle.puntajePersonalidad?.toFixed(1) ?? '—' },
                  { k: 'Lógica', v: detalle.puntajeLogica?.toFixed(1) ?? '—' },
                  { k: 'Semáforo', v: detalle.semaforo ?? '—' },
                  { k: 'DISC / perfil', v: detalle.perfilColor ?? '—' },
                  { k: 'GMA (0–5)', v: detalle.gma05 != null ? String(detalle.gma05) : '—' },
                  { k: 'Inicio', v: fechaCorta(detalle.examenInicioAt) },
                  { k: 'Completado', v: fechaCorta(detalle.examenCompletadoAt) },
                  { k: 'Fuente datos', v: detalle.fuente },
                ].map((item) => (
                  <div key={item.k} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="text-[10px] font-bold uppercase text-zinc-500">{item.k}</p>
                    <p className="mt-0.5 text-sm font-semibold text-zinc-100">{item.v}</p>
                  </div>
                ))}
              </div>

              {detalle.motivoSemaforo ? (
                <p className="text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-400">Motivo semáforo:</span> {detalle.motivoSemaforo}
                </p>
              ) : null}

              {sinRespuestas ? (
                <p className="rounded-lg border border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
                  No hay respuestas guardadas en el expediente ni en la invitación de examen.
                </p>
              ) : null}

              {preguntas && Object.keys(detalle.respuestasPersonalidad).length > 0 ? (
                <section>
                  <h3 className="text-sm font-bold text-violet-200">
                    {detalle.rolExamen === 'tecnico'
                      ? 'Conducta en obra (20 preguntas)'
                      : 'Personalidad (frecuencia)'}
                  </h3>
                  <ol className="mt-2 space-y-2">
                    {preguntas.personalidad.map((p, i) => {
                      const v = detalle.respuestasPersonalidad[p.id];
                      let etiqueta = 'Sin respuesta';
                      if (v != null) {
                        if (esPreguntaSituacionalObra(p) && v >= 0 && v < p.opciones.length) {
                          etiqueta = `${String.fromCharCode(65 + v)}) ${p.opciones[v]}`;
                        } else {
                          etiqueta = etiquetaFrecuenciaPersonalidad(v);
                        }
                      }
                      return (
                        <li
                          key={p.id}
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            v != null ? 'border-white/10 bg-black/20' : 'border-dashed border-zinc-700 text-zinc-600'
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase text-zinc-500">{p.bloque}</span>
                          <p className="mt-0.5 text-zinc-200">
                            {i + 1}. {p.texto}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-violet-200/90">{etiqueta}</p>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ) : null}

              {preguntas && Object.keys(detalle.respuestasLogica).length > 0 ? (
                <section>
                  <h3 className="text-sm font-bold text-cyan-200">
                    Lógica — {etiquetaRolExamenUI(detalle.rolExamen)}
                  </h3>
                  <ol className="mt-2 space-y-3">
                    {preguntas.logica.map((q, i) => {
                      const idx = detalle.respuestasLogica[q.id];
                      const ok = idx != null && idx === q.correcta;
                      return (
                        <li
                          key={q.id}
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            idx == null
                              ? 'border-dashed border-zinc-700'
                              : ok
                                ? 'border-emerald-500/30 bg-emerald-950/20'
                                : 'border-rose-500/30 bg-rose-950/20'
                          }`}
                        >
                          <p className="font-medium text-zinc-100">
                            {i + 1}. {q.texto}
                          </p>
                          <ul className="mt-2 space-y-1 pl-2 text-xs">
                            {q.opciones.map((op, j) => {
                              const elegida = idx === j;
                              const esCorrecta = j === q.correcta;
                              return (
                                <li
                                  key={op}
                                  className={
                                    elegida
                                      ? esCorrecta
                                        ? 'font-bold text-emerald-300'
                                        : 'font-bold text-rose-300'
                                      : esCorrecta
                                        ? 'text-emerald-600/80'
                                        : 'text-zinc-500'
                                  }
                                >
                                  {String.fromCharCode(65 + j)}) {op}
                                  {elegida ? ' ← respondió' : ''}
                                  {esCorrecta && !elegida ? ' (correcta)' : ''}
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ) : null}

              {detalle.invitacion ? (
                <p className="text-[11px] text-zinc-600">
                  Invitación: {detalle.invitacion.completado ? 'cerrada' : 'abierta'} · expira{' '}
                  {fechaCorta(detalle.invitacion.expiraAt)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
