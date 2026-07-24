'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock, FileText, Loader2, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiUrl } from '@/lib/http/apiUrl';

function hoyIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const selectElite =
  'w-full rounded-xl border border-white/[0.12] bg-black/50 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 [color-scheme:dark]';

export type ModalCompletarContratoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabase: SupabaseClient;
  /** `ci_empleados.id` */
  obreroId: string | null;
  nombrePrecargado?: string | null;
  cargoPrecargado?: string | null;
  proyectoNombrePrecargado?: string | null;
  onFinalizado?: (data: { contratoId: string }) => void;
};

type JornadaUi = 'diurna' | 'mixta' | 'nocturna';

export function ModalCompletarContrato({
  open,
  onOpenChange,
  supabase,
  obreroId,
  nombrePrecargado,
  cargoPrecargado,
  proyectoNombrePrecargado,
  onFinalizado,
}: ModalCompletarContratoProps) {
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [proyectoNombre, setProyectoNombre] = useState('');
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [cargandoCabecera, setCargandoCabecera] = useState(false);

  const [fechaIngreso, setFechaIngreso] = useState(hoyIsoLocal);
  const [jornada, setJornada] = useState<JornadaUi>('diurna');
  const [plazoTipo, setPlazoTipo] = useState<'determinado' | 'indeterminado'>('indeterminado');
  const [duracionValor, setDuracionValor] = useState<string>('');
  const [duracionUnidad, setDuracionUnidad] = useState<'dias' | 'meses'>('meses');

  const [previewMd, setPreviewMd] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFechaIngreso(hoyIsoLocal());
    setJornada('diurna');
    setPlazoTipo('indeterminado');
    setDuracionValor('');
    setDuracionUnidad('meses');
    setPreviewMd(null);

    const n0 = (nombrePrecargado ?? '').trim();
    const c0 = (cargoPrecargado ?? '').trim();
    const p0 = (proyectoNombrePrecargado ?? '').trim();
    if (n0) setNombre(n0);
    if (c0) setCargo(c0);
    if (p0) setProyectoNombre(p0);
  }, [open, nombrePrecargado, cargoPrecargado, proyectoNombrePrecargado]);

  useEffect(() => {
    if (!open || !obreroId) return;
    const id = obreroId.trim();
    let cancelled = false;
    (async () => {
      setCargandoCabecera(true);
      try {
        const { data: emp, error: eEmp } = await supabase
          .from('ci_empleados')
          .select('nombre_completo,cargo_nombre,proyecto_modulo_id,recruitment_need_id')
          .eq('id', id)
          .maybeSingle();
        if (cancelled) return;
        if (eEmp || !emp) {
          toast.error(eEmp?.message ?? 'No se pudo cargar el empleado');
          return;
        }
        const row = emp as {
          nombre_completo?: string | null;
          cargo_nombre?: string | null;
          proyecto_modulo_id?: string | null;
          recruitment_need_id?: string | null;
        };
        if (!(nombrePrecargado ?? '').trim()) {
          setNombre((row.nombre_completo ?? '').trim());
        }
        if (!(cargoPrecargado ?? '').trim()) {
          setCargo((row.cargo_nombre ?? '').trim());
        }

        let pid = (row.proyecto_modulo_id ?? '').trim() || null;
        const nid = (row.recruitment_need_id ?? '').trim();
        if (!pid && nid) {
          const { data: need } = await supabase
            .from('recruitment_needs')
            .select('proyecto_modulo_id,proyecto_id')
            .eq('id', nid)
            .maybeSingle();
          const nv = need as { proyecto_modulo_id?: string | null; proyecto_id?: string | null } | null;
          pid = (nv?.proyecto_modulo_id ?? nv?.proyecto_id ?? '').trim() || null;
        }
        if (cancelled) return;
        setProyectoId(pid);
        if (!(proyectoNombrePrecargado ?? '').trim() && pid) {
          const { data: proy } = await supabase.from('ci_proyectos').select('nombre').eq('id', pid).maybeSingle();
          if (cancelled) return;
          const pn = (proy as { nombre?: string | null } | null)?.nombre;
          setProyectoNombre((pn ?? '').trim() || '—');
        } else if (!(proyectoNombrePrecargado ?? '').trim()) {
          setProyectoNombre('—');
        }
      } finally {
        if (!cancelled) setCargandoCabecera(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, obreroId, supabase, nombrePrecargado, cargoPrecargado, proyectoNombrePrecargado]);

  const generarYPrevisualizar = async () => {
    const eid = (obreroId ?? '').trim();
    if (!eid) {
      toast.error('Falta el identificador del obrero.');
      return;
    }
    if (plazoTipo === 'determinado') {
      const n = Number(duracionValor.replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0) {
        toast.error('Indique la duración (número mayor a 0) para contrato a tiempo determinado.');
        return;
      }
    }

    setGenerando(true);
    try {
      const dv =
        plazoTipo === 'determinado' ? Math.floor(Number(String(duracionValor).replace(',', '.'))) : undefined;
      const res = await fetch(apiUrl('/api/talento/contratos/generar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          empleado_id: eid,
          fecha_ingreso: fechaIngreso,
          jornada_trabajo: jornada,
          tipoPlazo: plazoTipo === 'determinado' ? 'DETERMINADO' : 'INDETERMINADO',
          duracion_valor: plazoTipo === 'determinado' ? dv : undefined,
          duracion_unidad: plazoTipo === 'determinado' ? duracionUnidad : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; contrato?: string; error?: string };
      if (!res.ok || !json.success || !json.contrato) {
        toast.error(json.error ?? `Error ${res.status}`);
        return;
      }
      setPreviewMd(json.contrato);
      toast.success('Borrador generado. Revise el texto y pulse Finalizar para guardar.');
    } catch {
      toast.error('Error de red al generar el contrato');
    } finally {
      setGenerando(false);
    }
  };

  const finalizarContrato = async () => {
    const eid = (obreroId ?? '').trim();
    const md = (previewMd ?? '').trim();
    if (!eid || !md) {
      toast.error('Primero genere y revise la previsualización.');
      return;
    }
    const oid = (proyectoId ?? '').trim();
    if (!oid) {
      toast.error(
        'Este empleado no tiene proyecto vinculado. Asigne proyecto o vacante en RRHH antes de guardar el contrato.',
      );
      return;
    }

    setFinalizando(true);
    try {
      const { data, error } = await supabase
        .from('ci_contratos_empleado_obra')
        .insert({
          empleado_id: eid,
          obra_id: oid,
          proyecto_id: oid,
          texto_legal: md,
          fecha_ingreso: fechaIngreso,
          jornada_trabajo: jornada,
          tipo_contrato: plazoTipo === 'determinado' ? 'tiempo_determinado' : 'tiempo_indeterminado',
        } as never)
        .select('id')
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }
      const cid = String((data as { id: string }).id);
      toast.success('Contrato guardado en expediente.');
      onFinalizado?.({ contratoId: cid });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="modal-contrato"
          className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-contrato-titulo"
            className="relative z-[161] flex max-h-[min(92vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A0A0F] shadow-[0_24px_80px_rgba(0,0,0,0.85)]"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
              <div className="min-w-0">
                <h2 id="modal-contrato-titulo" className="text-lg font-bold tracking-tight text-white">
                  Completar contrato individual
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Datos laborales que faltan en la planilla · se envían junto al expediente en Supabase
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-5 grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Resumen expediente</p>
                {cargandoCabecera ? (
                  <p className="flex items-center gap-2 text-xs text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Cargando datos…
                  </p>
                ) : (
                  <>
                    <p className="text-zinc-200">
                      <span className="text-zinc-500">Nombre:</span> {nombre || '—'}
                    </p>
                    <p className="text-zinc-200">
                      <span className="text-zinc-500">Cargo:</span> {cargo || '—'}
                    </p>
                    <p className="text-zinc-200">
                      <span className="text-zinc-500">Proyecto:</span> {proyectoNombre || '—'}
                    </p>
                  </>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      <Calendar className="h-3.5 w-3.5 text-emerald-500/80" aria-hidden />
                      Fecha de ingreso
                    </label>
                    <input
                      type="date"
                      className={selectElite}
                      value={fechaIngreso}
                      onChange={(e) => setFechaIngreso(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      <Clock className="h-3.5 w-3.5 text-emerald-500/80" aria-hidden />
                      Jornada
                    </label>
                    <select className={selectElite} value={jornada} onChange={(e) => setJornada(e.target.value as JornadaUi)}>
                      <option value="diurna">Diurna (07:00am - 04:00pm)</option>
                      <option value="mixta">Mixta</option>
                      <option value="nocturna">Nocturna</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Duración del contrato</label>
                    <select
                      className={selectElite}
                      value={plazoTipo}
                      onChange={(e) => setPlazoTipo(e.target.value as 'determinado' | 'indeterminado')}
                    >
                      <option value="indeterminado">Tiempo indeterminado</option>
                      <option value="determinado">Tiempo determinado</option>
                    </select>
                    {plazoTipo === 'determinado' ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="Cantidad"
                          className={`${selectElite} min-w-[100px] flex-1`}
                          value={duracionValor}
                          onChange={(e) => setDuracionValor(e.target.value)}
                        />
                        <select
                          className={`${selectElite} w-[140px]`}
                          value={duracionUnidad}
                          onChange={(e) => setDuracionUnidad(e.target.value as 'dias' | 'meses')}
                        >
                          <option value="meses">Meses</option>
                          <option value="dias">Días</option>
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void generarYPrevisualizar()}
                      disabled={generando || cargandoCabecera}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.1] disabled:opacity-50"
                    >
                      {generando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                      Generar y previsualizar
                    </button>
                  </div>
                </div>

                <div className="flex min-h-[220px] flex-col rounded-xl border border-white/[0.08] bg-black/40">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
                    <FileText className="h-4 w-4 text-zinc-500" aria-hidden />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vista previa (Markdown)</span>
                  </div>
                  <div className="min-h-[200px] flex-1 overflow-y-auto p-3">
                    {previewMd ? (
                      <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-zinc-300">
                        {previewMd}
                      </pre>
                    ) : (
                      <p className="text-xs text-zinc-600">Pulse «Generar y previsualizar» para ver el borrador aquí.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-white/[0.12] px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void finalizarContrato()}
                disabled={finalizando || !previewMd}
                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl border-0 bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:opacity-45"
              >
                {finalizando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Finalizar contrato
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
