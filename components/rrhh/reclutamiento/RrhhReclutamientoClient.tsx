'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ClipboardCopy,
  ExternalLink,
  FileQuestion,
  Link2,
  RefreshCw,
  Send,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { esPreguntaSituacionalObra, etiquetaRolExamenUI } from '@/lib/talento/exam';
import { preguntasParaDetalle } from '@/lib/rrhh/parseRespuestasExamen';
import { fetchEmpleadosHojasVida, type EmpleadoHojaVidaRow } from '@/lib/rrhh/fetchEmpleadosHojasVida';
import {
  empleadoTieneEvaluacionCompleta,
  estadoEvaluacionFila,
  etiquetaEstadoEvaluacion,
} from '@/lib/rrhh/evaluacionObrero';
import { esStatusPendienteRegularizar } from '@/lib/talento/estadoEvaluacionExpress';
import {
  normCedula,
  type ExpressSinEvaluacion,
} from '@/lib/rrhh/evaluacionObrero';
import { apiUrl } from '@/lib/http/apiUrl';
import { hrefListaContratosExpress } from '@/lib/talento/hrefListaContratosExpress';
import { createClient } from '@/lib/supabase/client';
import type { RolExamen } from '@/types/talento';
import DetalleRespuestasExamenModal from '@/components/rrhh/reclutamiento/DetalleRespuestasExamenModal';

type TabId = 'examen' | 'evaluaciones' | 'pendientes';

function docMostrado(row: { cedula?: string | null; documento?: string | null }): string {
  return (row.cedula ?? row.documento ?? '').trim() || '—';
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function RrhhReclutamientoClient() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<TabId>('examen');
  const [rolPreview, setRolPreview] = useState<RolExamen>('tecnico');
  const [loading, setLoading] = useState(true);
  const [empleados, setEmpleados] = useState<EmpleadoHojaVidaRow[]>([]);
  const [expressRows, setExpressRows] = useState<ExpressSinEvaluacion[]>([]);
  const [filtroEval, setFiltroEval] = useState<'todos' | 'evaluados' | 'pendientes'>('todos');
  const [busqueda, setBusqueda] = useState('');

  const [invEmpleadoId, setInvEmpleadoId] = useState('');
  const [invCedula, setInvCedula] = useState('');
  const [invBusy, setInvBusy] = useState(false);
  const [ultimoEnlace, setUltimoEnlace] = useState<string | null>(null);
  const [detalleEmpleadoId, setDetalleEmpleadoId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const examenPreview = useMemo(() => preguntasParaDetalle(rolPreview), [rolPreview]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: emps, error: errEmp } = await fetchEmpleadosHojasVida(supabase, 'archivo');
    if (errEmp) {
      toast.error(errEmp);
      setEmpleados([]);
    } else {
      setEmpleados(emps);
    }

    const resEx = await supabase
      .from('ci_contratos_express')
      .select('id,created_at,obrero_nombre,obrero_cedula,formalizado_empleado_id')
      .order('created_at', { ascending: false })
      .limit(400);

    let exData: {
      id: string;
      created_at: string;
      obrero_nombre: string;
      obrero_cedula: string;
      formalizado_empleado_id?: string | null;
    }[] = [];

    if (!resEx.error && resEx.data) {
      exData = resEx.data as typeof exData;
    } else {
      const bare = await supabase
        .from('ci_contratos_express')
        .select('id,created_at,obrero_nombre,obrero_cedula')
        .order('created_at', { ascending: false })
        .limit(400);
      if (!bare.error && bare.data) exData = bare.data as typeof exData;
    }

    const porCedula = new Map<string, EmpleadoHojaVidaRow>();
    for (const e of emps) {
      const ck = normCedula(docMostrado(e));
      if (ck) porCedula.set(ck, e);
    }

    const expressMapped: ExpressSinEvaluacion[] = exData.map((x) => {
      const ck = normCedula(x.obrero_cedula);
      const emp = ck ? porCedula.get(ck) : undefined;
      const empId = (x.formalizado_empleado_id ?? emp?.id ?? '').trim() || null;
      return {
        id: x.id,
        obrero_nombre: x.obrero_nombre,
        obrero_cedula: x.obrero_cedula,
        created_at: x.created_at,
        formalizado_empleado_id: x.formalizado_empleado_id ?? null,
        empleado_id: empId,
        empleado_tiene_evaluacion: emp ? empleadoTieneEvaluacionCompleta(emp) : false,
      };
    });

    setExpressRows(expressMapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const empleadosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return empleados.filter((r) => {
      const est = estadoEvaluacionFila(r);
      if (filtroEval === 'evaluados' && est !== 'evaluado') return false;
      if (filtroEval === 'pendientes' && est === 'evaluado') return false;
      if (!q) return true;
      const blob = `${r.nombre_completo ?? ''} ${docMostrado(r)} ${r.cargo_nombre ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [empleados, filtroEval, busqueda]);

  const pendientesEmpleados = useMemo(
    () => empleados.filter((r) => estadoEvaluacionFila(r) !== 'evaluado'),
    [empleados],
  );

  const expressSinEvaluar = useMemo(
    () => expressRows.filter((x) => !x.empleado_tiene_evaluacion),
    [expressRows],
  );

  const stats = useMemo(() => {
    const evaluados = empleados.filter((e) => empleadoTieneEvaluacionCompleta(e)).length;
    return {
      total: empleados.length,
      evaluados,
      pendientes: empleados.length - evaluados,
      expressSin: expressSinEvaluar.length,
    };
  }, [empleados, expressSinEvaluar.length]);

  const emitirEnlace = useCallback(
    async (empleadoId: string, cedula: string) => {
      const eid = empleadoId.trim();
      const doc = cedula.trim();
      if (!eid || !doc) {
        toast.error('Indica expediente (UUID) y cédula.');
        return;
      }
      setInvBusy(true);
      try {
        const res = await fetch(apiUrl('/api/registro/emitir-invitacion-examen'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empleadoId: eid, cedula: doc }),
        });
        const j = (await res.json().catch(() => ({}))) as { exam_url?: string; error?: string };
        if (!res.ok) {
          toast.error(j.error ?? 'No se pudo generar el enlace');
          return;
        }
        if (!j.exam_url) {
          toast.error('Respuesta sin URL de examen');
          return;
        }
        setUltimoEnlace(j.exam_url);
        try {
          await navigator.clipboard.writeText(j.exam_url);
          toast.success('Enlace copiado al portapapeles');
        } catch {
          toast.message('Enlace generado (copia manual)');
        }
      } catch {
        toast.error('Error de red');
      } finally {
        setInvBusy(false);
      }
    },
    [],
  );

  const rellenarDesdeFila = (r: EmpleadoHojaVidaRow) => {
    setInvEmpleadoId(r.id);
    setInvCedula(docMostrado(r) === '—' ? '' : docMostrado(r));
  };

  const borrarEmpleado = useCallback(
    async (r: EmpleadoHojaVidaRow) => {
      const nombre = (r.nombre_completo ?? '').trim() || 'este trabajador';
      if (
        !window.confirm(
          `¿Eliminar a «${nombre}» de la lista?\n\nSe borrará el expediente (ci_empleados). Esta acción no se puede deshacer.`,
        )
      ) {
        return;
      }
      setDeletingId(r.id);
      const { error: delErr } = await supabase.from('ci_empleados').delete().eq('id', r.id);
      setDeletingId(null);
      if (delErr) {
        toast.error(delErr.message ?? 'No se pudo eliminar el trabajador.');
        return;
      }
      toast.success('Trabajador eliminado.');
      setEmpleados((prev) => prev.filter((x) => x.id !== r.id));
      setExpressRows((prev) =>
        prev.map((x) =>
          x.empleado_id === r.id
            ? { ...x, empleado_id: null, empleado_tiene_evaluacion: false }
            : x,
        ),
      );
    },
    [supabase],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      <header className="mb-6">
        <Link
          href="/rrhh/hojas-vida"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-300 hover:text-fuchsia-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          RRHH · SMART RRHH
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/90">
              Suboficina RRHH
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Reclutamiento</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Examen de ingreso, envío de invitaciones y seguimiento de evaluaciones (obreros y contratos express).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: 'En archivo', value: stats.total, tone: 'text-zinc-100' },
          { label: 'Con evaluación', value: stats.evaluados, tone: 'text-emerald-300' },
          { label: 'Sin evaluación', value: stats.pendientes, tone: 'text-amber-200' },
          { label: 'Express sin evaluar', value: stats.expressSin, tone: 'text-orange-200' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-1">
        {(
          [
            { id: 'examen' as const, label: 'Examen e invitación', icon: BookOpen },
            { id: 'evaluaciones' as const, label: 'Todas las evaluaciones', icon: UserCheck },
            { id: 'pendientes' as const, label: 'Pendientes / Express', icon: UserX },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-t-lg border px-4 py-2.5 text-sm font-semibold transition ${
              tab === id
                ? 'border-violet-500/40 border-b-transparent bg-violet-950/50 text-violet-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === 'examen' ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <FileQuestion className="h-5 w-5 text-violet-300" aria-hidden />
              Banco de preguntas del examen
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Obrero / técnico obra: 20 preguntas (4 opciones) + 5 lógica. Programador: 20 frecuencia + 5 lógica. Duración:
              15 minutos. Así se ve lo que responde el candidato en{' '}
              <Link href="/talento/examen" className="text-violet-300 underline hover:text-violet-200" target="_blank">
                /talento/examen
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['tecnico', 'programador'] as RolExamen[]).map((rol) => (
                <button
                  key={rol}
                  type="button"
                  onClick={() => setRolPreview(rol)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                    rolPreview === rol
                      ? 'border-violet-400/50 bg-violet-500/20 text-violet-100'
                      : 'border-white/15 text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  {rol === 'tecnico' ? 'Obrero' : 'Programador'}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-bold text-zinc-200">
                Conducta / personalidad ({examenPreview.personalidad.length})
              </h3>
              <ol className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1 text-sm text-zinc-300">
                {examenPreview.personalidad.map((p, i) => (
                  <li key={p.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase text-zinc-500">{p.bloque}</span>
                    <p className="mt-0.5">
                      {i + 1}. {p.texto}
                    </p>
                    {esPreguntaSituacionalObra(p) ? (
                      <ul className="mt-2 space-y-0.5 pl-2 text-xs text-zinc-500">
                        {p.opciones.map((op, j) => (
                          <li key={op}>
                            {String.fromCharCode(65 + j)}) {op}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-bold text-zinc-200">
                Lógica — {etiquetaRolExamenUI(rolPreview)} ({examenPreview.logica.length})
              </h3>
              <ol className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1 text-sm text-zinc-300">
                {examenPreview.logica.map((q, i) => (
                  <li key={q.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <p className="font-medium text-zinc-100">
                      {i + 1}. {q.texto}
                    </p>
                    <ul className="mt-2 space-y-1 pl-3 text-xs text-zinc-500">
                      {q.opciones.map((op, j) => (
                        <li key={op} className={j === q.correcta ? 'text-emerald-400/90' : undefined}>
                          {String.fromCharCode(65 + j)}) {op}
                          {j === q.correcta ? ' ✓' : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Send className="h-5 w-5 text-emerald-300" aria-hidden />
              Enviar a evaluar
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Genera el enlace <code className="text-zinc-500">/talento/examen?token=…</code> validado con la cédula del
              expediente. También puedes elegir una fila en «Todas las evaluaciones» o «Pendientes».
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-zinc-500">
                ID expediente (UUID)
                <input
                  value={invEmpleadoId}
                  onChange={(e) => setInvEmpleadoId(e.target.value)}
                  placeholder="00000000-0000-…"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
              <label className="block text-xs text-zinc-500">
                Cédula (validación)
                <input
                  value={invCedula}
                  onChange={(e) => setInvCedula(e.target.value)}
                  placeholder="V-12345678"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={invBusy}
                onClick={() => void emitirEnlace(invEmpleadoId, invCedula)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" />
                {invBusy ? 'Generando…' : 'Generar y copiar enlace'}
              </button>
              {ultimoEnlace ? (
                <>
                  <a
                    href={ultimoEnlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir examen
                  </a>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(ultimoEnlace)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/10"
                  >
                    <ClipboardCopy className="h-4 w-4" />
                    Copiar
                  </button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'evaluaciones' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre, cédula, cargo…"
              className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100"
            />
            <select
              value={filtroEval}
              onChange={(e) => setFiltroEval(e.target.value as typeof filtroEval)}
              className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
            >
              <option value="todos">Todos</option>
              <option value="evaluados">Con evaluación</option>
              <option value="pendientes">Sin evaluación</option>
            </select>
          </div>
          {loading ? <p className="text-sm text-zinc-500">Cargando…</p> : null}
          {!loading && empleadosFiltrados.length === 0 ? (
            <p className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-zinc-500">Sin resultados.</p>
          ) : null}
          <ul className="space-y-2">
            {empleadosFiltrados.map((r) => {
              const doc = docMostrado(r);
              const est = estadoEvaluacionFila(r);
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{(r.nombre_completo ?? '').trim() || 'Sin nombre'}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {doc} · {(r.cargo_nombre ?? '—').trim()}
                      {r.examen_completado_at ? ` · Examen ${fechaCorta(r.examen_completado_at)}` : ''}
                    </p>
                    <p className="mt-1 text-xs">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-semibold ${
                          esStatusPendienteRegularizar(r.status_evaluacion)
                            ? 'border-orange-500/40 bg-orange-950/45 text-orange-200'
                            : est === 'evaluado'
                              ? 'border-emerald-500/35 bg-emerald-950/40 text-emerald-200'
                              : est === 'en_curso'
                                ? 'border-amber-500/35 bg-amber-950/40 text-amber-200'
                                : 'border-rose-500/35 bg-rose-950/40 text-rose-200'
                        }`}
                      >
                        {etiquetaEstadoEvaluacion(r)}
                      </span>
                      {r.puntaje_total != null ? (
                        <span className="ml-2 text-zinc-500">Puntaje {r.puntaje_total.toFixed(1)}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {(est === 'evaluado' || est === 'en_curso') && (
                      <button
                        type="button"
                        onClick={() => setDetalleEmpleadoId(r.id)}
                        className="rounded-lg border border-violet-500/35 bg-violet-950/35 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-900/45"
                      >
                        Ver respuestas
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        rellenarDesdeFila(r);
                        setTab('examen');
                      }}
                      className="rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
                    >
                      Enviar examen
                    </button>
                    <Link
                      href={`/rrhh/hojas-vida/archivo`}
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                    >
                      Archivo HV
                    </Link>
                    <button
                      type="button"
                      onClick={() => void borrarEmpleado(r)}
                      disabled={deletingId === r.id}
                      title="Eliminar trabajador de la lista"
                      aria-label={`Eliminar a ${(r.nombre_completo ?? '').trim() || 'trabajador'}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-xs font-semibold text-red-300 transition hover:border-red-400/50 hover:bg-red-950/40 disabled:opacity-50"
                    >
                      <Trash2 className={`h-3.5 w-3.5 ${deletingId === r.id ? 'animate-pulse' : ''}`} aria-hidden />
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {tab === 'pendientes' ? (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold text-amber-100">Obreros sin evaluación completada</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Expedientes en archivo que aún no tienen examen registrado (pueden tener hoja de vida).
            </p>
            {pendientesEmpleados.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No hay pendientes en este grupo.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {pendientesEmpleados.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-950/15 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-zinc-100">{(r.nombre_completo ?? '').trim() || 'Sin nombre'}</p>
                      <p className="text-xs text-zinc-500">
                        {docMostrado(r)} · {etiquetaEstadoEvaluacion(r)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        rellenarDesdeFila(r);
                        void emitirEnlace(r.id, docMostrado(r) === '—' ? '' : docMostrado(r));
                      }}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-100"
                    >
                      Generar enlace examen
                    </button>
                    <button
                      type="button"
                      onClick={() => void borrarEmpleado(r)}
                      disabled={deletingId === r.id}
                      title="Eliminar trabajador de la lista"
                      aria-label={`Eliminar a ${(r.nombre_completo ?? '').trim() || 'trabajador'}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-xs font-semibold text-red-300 transition hover:border-red-400/50 hover:bg-red-950/40 disabled:opacity-50"
                    >
                      <Trash2 className={`h-3.5 w-3.5 ${deletingId === r.id ? 'animate-pulse' : ''}`} aria-hidden />
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-bold text-orange-100">Contratos express sin evaluación</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Fast-track sin evaluación registrada: formaliza en Talento o envía examen si ya existe expediente con la
              misma cédula.
            </p>
            {expressSinEvaluar.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Todos los express visibles tienen evaluación o están formalizados.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {expressSinEvaluar.map((x) => (
                  <li
                    key={x.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-500/25 bg-orange-950/20 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-zinc-100">{x.obrero_nombre}</p>
                      <p className="text-xs text-zinc-500">
                        {x.obrero_cedula} · Express {fechaCorta(x.created_at)}
                        {x.empleado_id ? ' · Hay expediente' : ' · Sin expediente en ci_empleados'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {x.empleado_id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setDetalleEmpleadoId(x.empleado_id!)}
                            className="rounded-lg border border-violet-500/35 bg-violet-950/35 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-900/45"
                          >
                            Ver respuestas
                          </button>
                          <button
                            type="button"
                            onClick={() => void emitirEnlace(x.empleado_id!, x.obrero_cedula)}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-100"
                          >
                            Enviar examen
                          </button>
                        </>
                      ) : (
                        <Link
                          href="/talento/admin/contratos/fast-create"
                          className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-100"
                        >
                          Crear express / formalizar
                        </Link>
                      )}
                      <Link
                        href={hrefListaContratosExpress()}
                        className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"
                      >
                        Lista express
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <DetalleRespuestasExamenModal
        open={detalleEmpleadoId != null}
        empleadoId={detalleEmpleadoId}
        onClose={() => setDetalleEmpleadoId(null)}
      />
    </div>
  );
}
