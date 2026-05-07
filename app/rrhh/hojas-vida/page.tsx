'use client';

import Link from 'next/link';
import { FileText, Link2, MessageSquareText, RefreshCw, ScrollText, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ModalGenerarContrato } from '@/app/rrhh/hojas-vida/components/ModalGenerarContrato';
import { apiUrl } from '@/lib/http/apiUrl';
import { createClient } from '@/lib/supabase/client';
import type { DatoContratoFaltante } from '@/lib/talento/plantillaContratoObreroCompile';

type EmpleadoRow = {
  id: string;
  nombre_completo: string | null;
  documento: string | null;
  cedula: string | null;
  celular: string | null;
  telefono: string | null;
  created_at: string;
  estado_proceso: string | null;
  estado: string | null;
  cargo_nombre: string | null;
  recruitment_need_id: string | null;
  proyecto_modulo_id: string | null;
  observaciones_rrhh: string | null;
  status_evaluacion: string | null;
  semaforo: string | null;
  semaforo_riesgo: string | null;
  perfil_color: string | null;
  motivo_semaforo: string | null;
  motivo_semaforo_riesgo: string | null;
  puntaje_total: number | null;
  puntaje_logica: number | null;
  puntaje_personalidad: number | null;
  puntuacion_logica: number | null;
  puntuacion_confiabilidad: number | null;
  nivel_integridad_riesgo: string | null;
  tiempo_respuesta: number | null;
  examen_completado_at: string | null;
};

function docMostrado(row: EmpleadoRow): string {
  return (row.cedula ?? row.documento ?? '').trim() || '—';
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function RrhhHojasVidaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<EmpleadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingObsId, setSavingObsId] = useState<string | null>(null);
  const [obsOpen, setObsOpen] = useState(false);
  const [obsDraft, setObsDraft] = useState('');
  const [obsRow, setObsRow] = useState<EmpleadoRow | null>(null);
  const [informeOpen, setInformeOpen] = useState(false);
  const [informeRow, setInformeRow] = useState<EmpleadoRow | null>(null);
  /** Resolución proyecto/vacante al abrir el modal de contrato (por fila). */
  const [contratoModalPrepId, setContratoModalPrepId] = useState<string | null>(null);
  const [contratoGenOpen, setContratoGenOpen] = useState(false);
  const [contratoGenEmpleadoId, setContratoGenEmpleadoId] = useState<string | null>(null);
  const [contratoGenNombre, setContratoGenNombre] = useState<string | null>(null);
  const [contratoGenObraId, setContratoGenObraId] = useState<string | null>(null);
  const [validandoContratoId, setValidandoContratoId] = useState<string | null>(null);
  const [faltantesOpen, setFaltantesOpen] = useState(false);
  const [faltantesRow, setFaltantesRow] = useState<EmpleadoRow | null>(null);
  const [faltantesContrato, setFaltantesContrato] = useState<DatoContratoFaltante[]>([]);
  const [overridesDraft, setOverridesDraft] = useState<Record<string, string>>({});
  const [pdfFaltantesBusy, setPdfFaltantesBusy] = useState(false);
  const [revalidandoFaltantes, setRevalidandoFaltantes] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);

    const colsMinimas =
      'id,nombre_completo,documento,cedula,celular,telefono,created_at,estado_proceso,estado,cargo_nombre,recruitment_need_id,proyecto_modulo_id';
    const colsExtendidas =
      'status_evaluacion,semaforo,semaforo_riesgo,perfil_color,motivo_semaforo,motivo_semaforo_riesgo,puntaje_total,puntaje_logica,puntaje_personalidad,puntuacion_logica,puntuacion_confiabilidad,nivel_integridad_riesgo,tiempo_respuesta,examen_completado_at,observaciones_rrhh';
    const withObsCols = `${colsMinimas},${colsExtendidas}`;

    let result: {
      data: EmpleadoRow[] | null;
      error: { message: string } | null;
    } = (await supabase
      .from('ci_empleados')
      .select(withObsCols)
      .eq('estado_proceso', 'cv_completado')
      .order('created_at', { ascending: false })
      .limit(300)) as unknown as {
      data: EmpleadoRow[] | null;
      error: { message: string } | null;
    };

    // Compatibilidad temporal: si faltan columnas nuevas (observaciones/perfil/color/evaluación), reintenta con mínimas.
    if (result.error) {
      result = (await supabase
        .from('ci_empleados')
        .select(colsMinimas)
        .eq('estado_proceso', 'cv_completado')
        .order('created_at', { ascending: false })
        .limit(300)) as unknown as {
        data: EmpleadoRow[] | null;
        error: { message: string } | null;
      };
    }

    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      setRows([]);
      return;
    }
    const mapped = ((result.data ?? []) as EmpleadoRow[]).map((r) => ({
      ...r,
      estado: r.estado ?? null,
      status_evaluacion: r.status_evaluacion ?? null,
      semaforo: r.semaforo ?? null,
      semaforo_riesgo: r.semaforo_riesgo ?? null,
      perfil_color: r.perfil_color ?? null,
      motivo_semaforo: r.motivo_semaforo ?? null,
      motivo_semaforo_riesgo: r.motivo_semaforo_riesgo ?? null,
      puntaje_total: r.puntaje_total ?? null,
      puntaje_logica: r.puntaje_logica ?? null,
      puntaje_personalidad: r.puntaje_personalidad ?? null,
      puntuacion_logica: r.puntuacion_logica ?? null,
      puntuacion_confiabilidad: r.puntuacion_confiabilidad ?? null,
      nivel_integridad_riesgo: r.nivel_integridad_riesgo ?? null,
      tiempo_respuesta: r.tiempo_respuesta ?? null,
      examen_completado_at: r.examen_completado_at ?? null,
      observaciones_rrhh: r.observaciones_rrhh ?? null,
    }));
    setRows(mapped);
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const emitirEnlaceEvaluacion = useCallback(async (r: EmpleadoRow) => {
    const doc = docMostrado(r);
    if (doc === '—') {
      toast.error('Sin cédula en el expediente: no se puede validar el enlace de evaluación.');
      return;
    }
    try {
      const res = await fetch(apiUrl('/api/registro/emitir-invitacion-examen'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empleadoId: r.id, cedula: doc }),
      });
      const j = (await res.json().catch(() => ({}))) as { exam_url?: string; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo generar el enlace de evaluación');
        return;
      }
      if (!j.exam_url) {
        toast.error('Respuesta sin URL de evaluación');
        return;
      }
      try {
        await navigator.clipboard.writeText(j.exam_url);
        toast.success('Enlace copiado; se abre en una nueva pestaña.');
      } catch {
        toast.message('Enlace listo (no se pudo copiar al portapapeles automáticamente)');
      }
      window.open(j.exam_url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Error de red al solicitar el enlace');
    }
  }, []);

  const tieneInformeEvaluacion = useCallback((r: EmpleadoRow) => {
    return Boolean(
      r.examen_completado_at ||
        r.status_evaluacion ||
        r.puntaje_total != null ||
        r.puntuacion_logica != null,
    );
  }, []);

  const abrirObservaciones = useCallback((r: EmpleadoRow) => {
    setObsRow(r);
    setObsDraft((r.observaciones_rrhh ?? '').trim());
    setObsOpen(true);
  }, []);

  const guardarObservaciones = useCallback(async () => {
    if (!obsRow) return;
    setSavingObsId(obsRow.id);
    const valor = obsDraft.trim();
    const { error: upErr } = await supabase
      .from('ci_empleados')
      .update({ observaciones_rrhh: valor || null } as never)
      .eq('id', obsRow.id);
    setSavingObsId(null);
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === obsRow.id ? { ...r, observaciones_rrhh: valor || null } : r)),
    );
    toast.success('Observaciones guardadas');
    setObsOpen(false);
    setObsRow(null);
  }, [obsDraft, obsRow, supabase]);

  const prepararYAbrirModalContrato = useCallback(
    async (r: EmpleadoRow) => {
      setContratoModalPrepId(r.id);
      try {
        let oid = (r.proyecto_modulo_id ?? '').trim() || null;
        const nid = (r.recruitment_need_id ?? '').trim();
        if (!oid && nid) {
          const { data, error } = await supabase
            .from('recruitment_needs')
            .select('proyecto_modulo_id,proyecto_id')
            .eq('id', nid)
            .maybeSingle();
          if (!error && data) {
            const d = data as { proyecto_modulo_id?: string | null; proyecto_id?: string | null };
            oid = (d.proyecto_modulo_id ?? d.proyecto_id ?? '').trim() || null;
          }
        }
        setContratoGenEmpleadoId(r.id);
        setContratoGenNombre((r.nombre_completo ?? '').trim() || null);
        setContratoGenObraId(oid);
        setContratoGenOpen(true);
      } finally {
        setContratoModalPrepId(null);
      }
    },
    [supabase],
  );

  const abrirModalGenerarContrato = useCallback(async () => {
    if (!informeRow) return;
    await prepararYAbrirModalContrato(informeRow);
  }, [informeRow, prepararYAbrirModalContrato]);

  const borrarEmpleado = useCallback(
    async (r: EmpleadoRow) => {
      const nombre = (r.nombre_completo ?? '').trim() || 'este registro';
      if (
        !window.confirm(
          `¿Eliminar a «${nombre}» de la base de datos?\n\nSe borrará el expediente (ci_empleados). Esta acción no se puede deshacer.`,
        )
      ) {
        return;
      }
      setDeletingId(r.id);
      setError(null);
      const { error: delErr } = await supabase.from('ci_empleados').delete().eq('id', r.id);
      setDeletingId(null);
      if (delErr) {
        setError(delErr.message);
        return;
      }
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    },
    [supabase],
  );

  const validarYAbrirContrato = useCallback(async (r: EmpleadoRow) => {
    setValidandoContratoId(r.id);
    try {
      window.open(
        apiUrl(`/api/rrhh/empleados/${encodeURIComponent(r.id)}/contrato-laboral-pdf?formato=estructurado`),
        '_blank',
        'noopener,noreferrer',
      );
    } catch {
      toast.error('Error al abrir el contrato PDF');
    } finally {
      setValidandoContratoId(null);
    }
  }, []);

  const overridesDesdeBorrador = useCallback(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(overridesDraft)) {
      const t = String(v ?? '').trim();
      if (t && /^[A-Z0-9_]+$/.test(k)) out[k] = t;
    }
    return out;
  }, [overridesDraft]);

  const reaplicarFaltantesConOverrides = useCallback(async () => {
    if (!faltantesRow) return;
    setRevalidandoFaltantes(true);
    try {
      const overrides = overridesDesdeBorrador();
      const res = await fetch(apiUrl(`/api/rrhh/empleados/${encodeURIComponent(faltantesRow.id)}/contrato-vista`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ overrides }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        faltantes?: DatoContratoFaltante[];
      };
      if (!res.ok) {
        toast.error(j.error ?? `No se pudo recomprobar (${res.status})`);
        return;
      }
      const falt = Array.isArray(j.faltantes) ? j.faltantes : [];
      setFaltantesContrato(falt);
      toast.message(falt.length === 0 ? 'Con estos valores ya no faltan datos en la plantilla.' : `Aún faltan ${falt.length} dato(s).`);
    } catch {
      toast.error('Error de red al recomprobar');
    } finally {
      setRevalidandoFaltantes(false);
    }
  }, [faltantesRow, overridesDesdeBorrador]);

  const generarPdfContratoConOverrides = useCallback(async () => {
    if (!faltantesRow) return;
    setPdfFaltantesBusy(true);
    try {
      const overrides = overridesDesdeBorrador();
      const res = await fetch(apiUrl(`/api/rrhh/empleados/${encodeURIComponent(faltantesRow.id)}/contrato-laboral-pdf`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ overrides }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? `No se pudo generar el PDF (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('PDF generado (valores manuales aplicados donde corresponda).');
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      toast.error('Error de red al generar el PDF');
    } finally {
      setPdfFaltantesBusy(false);
    }
  }, [faltantesRow, overridesDesdeBorrador]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-8">
      <header className="mb-8">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Casa Inteligente</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">RRHH — Hojas de vida recibidas</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Expedientes «cv_completado». <span className="text-zinc-200">Hoja de empleo</span> /{' '}
              <span className="text-zinc-200">Hoja de vida</span> abren el visor PDF. <span className="text-zinc-200">Evaluación</span>{' '}
              genera el enlace <code className="text-zinc-500">/talento/examen?token=…</code> (copia y abre; valida con la
              cédula del expediente). Onboarding PDF:{' '}
              <code className="text-zinc-500">/api/talento/hoja-vida/pdf?token=…</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/rrhh/oficios-salarios"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <ScrollText className="h-4 w-4" />
              Oficios y salarios
            </Link>
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      {loading && rows.length === 0 ? <p className="text-sm text-zinc-500">Cargando lista…</p> : null}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-zinc-500">
          Aún no hay registros con hoja de vida completada.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((r) => {
            const nombre = (r.nombre_completo ?? '').trim() || 'Sin nombre';
            const cargo = (r.cargo_nombre ?? '').trim() || '—';
            const doc = docMostrado(r);
            const pdfBase = `/registro/planilla?empleadoId=${encodeURIComponent(r.id)}&cedula=${encodeURIComponent(doc === '—' ? '' : doc)}&volver=${encodeURIComponent('/rrhh/hojas-vida')}`;
            const pdfHojaVida = `${pdfBase}&tipo=hoja_vida`;
            const pdfHojaEmpleo = `${pdfBase}&tipo=hoja_empleo`;
            const proyectoHref = r.proyecto_modulo_id
              ? `/proyectos/modulo/${encodeURIComponent(r.proyecto_modulo_id)}?tab=rrhh`
              : null;

            return (
              <li
                key={r.id}
                className="flex flex-col gap-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{nombre}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Cédula / doc.: <span className="text-zinc-300">{doc}</span>
                    {' · '}
                    <span className="text-zinc-500">{fechaCorta(r.created_at)}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Cargo: <span className="text-zinc-200">{cargo}</span>
                    {r.recruitment_need_id ? <span className="text-zinc-600"> · Vacante vinculada</span> : null}
                  </p>
                </div>
                <div className="mt-3 flex w-full flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  {doc !== '—' ? (
                    <>
                      <a
                        href={pdfHojaEmpleo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF9500]/35 bg-[#FF9500]/15 px-3 py-2 text-xs font-bold text-[#FFD60A] transition hover:bg-[#FF9500]/25"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Hoja de empleo
                      </a>
                      <a
                        href={pdfHojaVida}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                      >
                        <FileText className="h-3.5 w-3.5 opacity-70" />
                        Hoja de vida
                      </a>
                      <div className="inline-flex rounded-lg border border-emerald-600/40 bg-emerald-950/20 p-0.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => {
                            if (tieneInformeEvaluacion(r)) {
                              setInformeRow(r);
                              setInformeOpen(true);
                              return;
                            }
                            void emitirEnlaceEvaluacion(r);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-900/50"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {tieneInformeEvaluacion(r) ? 'Informe evaluación' : 'Evaluación'}
                        </button>
                        <span className="w-px shrink-0 bg-emerald-700/50" aria-hidden />
                        <button
                          type="button"
                          onClick={() => void validarYAbrirContrato(r)}
                          disabled={validandoContratoId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-semibold text-emerald-100/95 transition hover:bg-emerald-900/50"
                          title="Previsualizar contrato individual (PDF)"
                        >
                          <ScrollText className="h-3.5 w-3.5 opacity-90" />
                          {validandoContratoId === r.id ? '…' : 'Contrato'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void validarYAbrirContrato(r)}
                          disabled={validandoContratoId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-[10px] font-semibold text-emerald-200/80 transition hover:bg-emerald-900/40"
                          title="Plantilla PDF con placeholders"
                        >
                          {validandoContratoId === r.id ? '…' : 'PDF'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => abrirObservaciones(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-950/30 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-900/40"
                      >
                        <MessageSquareText className="h-3.5 w-3.5" />
                        Observaciones
                      </button>
                    </>
                  ) : null}
                  {proyectoHref ? (
                    <Link
                      href={proyectoHref}
                      className="inline-flex rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                    >
                      Proyecto RRHH
                    </Link>
                  ) : null}
                  <Link
                    href={`/empleados/${encodeURIComponent(r.id)}`}
                    className="inline-flex rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
                  >
                    Ficha
                  </Link>
                  <button
                    type="button"
                    onClick={() => void borrarEmpleado(r)}
                    disabled={deletingId === r.id}
                    title="Eliminar expediente del obrero"
                    aria-label={`Eliminar expediente de ${nombre}`}
                    className="inline-flex items-center justify-center rounded-lg border border-red-500/25 bg-red-950/20 p-2 text-red-300 transition hover:border-red-400/50 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    <Trash2 className={`h-4 w-4 ${deletingId === r.id ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {informeOpen && informeRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-br from-[#0F1117] via-[#101522] to-[#0A0A0F] p-5 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Informe de evaluación</h2>
                <p className="mt-1 text-xs text-zinc-400">
                  {(informeRow.nombre_completo ?? 'Sin nombre').trim() || 'Sin nombre'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span
                  className={`rounded-full border px-2.5 py-1 ${
                    informeRow.semaforo === 'verde'
                      ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                      : informeRow.semaforo === 'amarillo'
                        ? 'border-amber-400/40 bg-amber-500/20 text-amber-200'
                        : informeRow.semaforo === 'rojo'
                          ? 'border-rose-400/40 bg-rose-500/20 text-rose-200'
                          : 'border-white/20 bg-white/5 text-zinc-300'
                  }`}
                >
                  Semáforo {informeRow.semaforo ?? '—'}
                </span>
                <span className="rounded-full border border-sky-400/35 bg-sky-500/20 px-2.5 py-1 text-sky-200">
                  DISC {informeRow.perfil_color ?? '—'}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Puntaje total</p>
                <p className="mt-1 text-lg font-black text-white">
                  {informeRow.puntaje_total != null ? informeRow.puntaje_total.toFixed(1) : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Lógica</p>
                <p className="mt-1 text-lg font-black text-cyan-200">
                  {informeRow.puntaje_logica != null
                    ? informeRow.puntaje_logica.toFixed(1)
                    : informeRow.puntuacion_logica != null
                      ? informeRow.puntuacion_logica.toFixed(1)
                      : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Personalidad</p>
                <p className="mt-1 text-lg font-black text-fuchsia-200">
                  {informeRow.puntaje_personalidad != null ? informeRow.puntaje_personalidad.toFixed(1) : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Confiabilidad</p>
                <p className="mt-1 text-lg font-black text-emerald-200">
                  {informeRow.puntuacion_confiabilidad != null ? informeRow.puntuacion_confiabilidad.toFixed(1) : '—'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300 sm:grid-cols-2">
              <p>
                Estado de contratación:{' '}
                <span className={`font-semibold ${informeRow.estado === 'aprobado' ? 'text-emerald-300' : 'text-zinc-100'}`}>
                  {informeRow.estado ?? '—'}
                </span>
              </p>
              <p>
                Estado: <span className="font-semibold text-zinc-100">{informeRow.status_evaluacion ?? '—'}</span>
              </p>
              <p>
                Riesgo: <span className="font-semibold text-zinc-100">{informeRow.semaforo_riesgo ?? '—'}</span>
              </p>
              <p>
                Integridad/riesgo:{' '}
                <span className="font-semibold text-zinc-100">{informeRow.nivel_integridad_riesgo ?? '—'}</span>
              </p>
              <p>
                Tiempo respuesta:{' '}
                <span className="font-semibold text-zinc-100">
                  {informeRow.tiempo_respuesta != null ? `${informeRow.tiempo_respuesta}s` : '—'}
                </span>
              </p>
            </div>

            <div className="mt-3 space-y-2 text-xs text-zinc-300">
              <p>Motivo semáforo: {informeRow.motivo_semaforo ?? '—'}</p>
              <p>Motivo riesgo: {informeRow.motivo_semaforo_riesgo ?? '—'}</p>
              <p>Completado: {informeRow.examen_completado_at ? fechaCorta(informeRow.examen_completado_at) : '—'}</p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void abrirModalGenerarContrato()}
                disabled={contratoModalPrepId !== null || informeRow.estado === 'aprobado'}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
              >
                {informeRow.estado === 'aprobado'
                  ? 'Ya aprobado para contrato'
                  : contratoModalPrepId !== null
                    ? 'Preparando…'
                    : 'Aprobar para contrato'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setInformeOpen(false);
                  setInformeRow(null);
                }}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ModalGenerarContrato
        open={contratoGenOpen}
        onOpenChange={(v) => {
          setContratoGenOpen(v);
          if (!v) {
            setContratoGenEmpleadoId(null);
            setContratoGenNombre(null);
            setContratoGenObraId(null);
          }
        }}
        supabase={supabase}
        obreroId={contratoGenEmpleadoId}
        obraId={contratoGenObraId}
        nombreObrero={contratoGenNombre}
        onExito={({ portalUrl: url }) => {
          const eid = (contratoGenEmpleadoId ?? '').trim();
          if (!eid) return;
          setRows((prev) => prev.map((r) => (r.id === eid ? { ...r, estado: 'aprobado' } : r)));
          setInformeRow((prev) => (prev?.id === eid ? { ...prev, estado: 'aprobado' } : prev));
          setInformeOpen(false);
          setInformeRow(null);
          setContratoGenEmpleadoId(null);
          setContratoGenNombre(null);
          setContratoGenObraId(null);
          if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        }}
      />

      {obsOpen && obsRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F1117] p-5 shadow-2xl">
            <h2 className="text-base font-bold text-white">Observaciones RRHH</h2>
            <p className="mt-1 text-xs text-zinc-400">{(obsRow.nombre_completo ?? 'Sin nombre').trim() || 'Sin nombre'}</p>
            <textarea
              value={obsDraft}
              onChange={(e) => setObsDraft(e.target.value)}
              rows={6}
              placeholder="Escribe observaciones internas de RRHH para este obrero..."
              className="mt-4 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/60"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setObsOpen(false);
                  setObsRow(null);
                }}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardarObservaciones()}
                disabled={savingObsId === obsRow.id}
                className="rounded-lg border border-sky-500/40 bg-sky-950/30 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-900/40 disabled:opacity-60"
              >
                {savingObsId === obsRow.id ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {faltantesOpen && faltantesRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-amber-400/25 bg-[#0F1117] p-5 shadow-2xl">
            <h2 className="text-base font-bold text-amber-100">Datos pendientes para generar contrato</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {(faltantesRow.nombre_completo ?? 'Sin nombre').trim() || 'Sin nombre'} · puedes completar la planilla o escribir
              aquí los valores que faltan. Placeholder en plantilla:{' '}
              <span className="font-mono text-zinc-300">{'{{'}CLAVE{'}}'}</span> en la
              plantilla.
            </p>
            <ul className="mt-4 max-h-[46vh] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
              {faltantesContrato.length === 0 ? (
                <li className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-3 text-emerald-100/95">
                  No hay datos pendientes en la plantilla con los valores actuales (manuales + expediente). Puedes generar el
                  PDF.
                </li>
              ) : null}
              {faltantesContrato.map((f) => (
                <li key={f.id} className="rounded-lg border border-amber-500/20 bg-amber-950/15 px-3 py-2">
                  <p className="font-semibold text-amber-100">
                    {f.etiqueta}{' '}
                    <span className="font-normal font-mono text-[10px] text-zinc-500">({f.id})</span>
                  </p>
                  <p className="mt-0.5 text-amber-100/80">{f.ayuda}</p>
                  <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Valor manual
                    <textarea
                      value={overridesDraft[f.id] ?? ''}
                      onChange={(e) =>
                        setOverridesDraft((prev) => ({
                          ...prev,
                          [f.id]: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Escribe el texto que debe aparecer en el contrato…"
                      className="mt-1 w-full resize-y rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
                    />
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void generarPdfContratoConOverrides()}
                disabled={pdfFaltantesBusy}
                className="rounded-lg border border-emerald-500/45 bg-emerald-950/35 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/45 disabled:opacity-50"
              >
                {pdfFaltantesBusy ? 'Generando PDF…' : 'Generar PDF con valores indicados'}
              </button>
              <button
                type="button"
                onClick={() => void reaplicarFaltantesConOverrides()}
                disabled={revalidandoFaltantes}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
              >
                {revalidandoFaltantes ? 'Recomprobando…' : 'Aplicar y ver qué sigue faltando'}
              </button>
              <a
                href={apiUrl(
                  `/registro/planilla?empleadoId=${encodeURIComponent(faltantesRow.id)}&cedula=${encodeURIComponent(docMostrado(faltantesRow) === '—' ? '' : docMostrado(faltantesRow))}&volver=${encodeURIComponent('/rrhh/hojas-vida')}`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/25"
              >
                Completar planilla
              </a>
              <button
                type="button"
                onClick={() => {
                  setFaltantesOpen(false);
                  setFaltantesRow(null);
                  setFaltantesContrato([]);
                  setOverridesDraft({});
                }}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
