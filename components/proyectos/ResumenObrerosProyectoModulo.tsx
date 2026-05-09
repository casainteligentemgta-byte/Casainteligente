'use client';

import Link from 'next/link';
import { ClipboardList, UserCheck, UserMinus, Users, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type ResumenObrerosProyectoModuloProps = {
  proyectoModuloId: string;
  /** Mismo tick que vacantes (p. ej. `rrhhVacantesTick`) para refrescar tras altas. */
  listaRefresco?: number;
  /** Valor de `?tab=` en la URL; al cambiar se vuelve a cargar el cuadro (p. ej. vista RRHH directa). */
  tabUrl?: string;
};

type NeedLite = {
  id: string;
  cantidad_requerida: number | null;
  protocol_active: boolean | null;
  cargo_nombre: string | null;
  title: string | null;
};

type EmpleadoLite = {
  id: string;
  nombre_completo: string | null;
  nombres: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  cedula: string | null;
  documento: string | null;
  celular: string | null;
  telefono: string | null;
  cargo_nombre: string | null;
  cargo_codigo: string | null;
  estado: string | null;
  estado_proceso: string | null;
  recruitment_need_id: string | null;
  /** Legacy RRHH: verde = apto, rojo/rechazado = no apto, amarillo = en curso. */
  status_evaluacion: string | null;
};

type FilaContratoObra = {
  obra_id: string | null;
  estado_contrato: string;
};

type ListaModalTipo = 'enCarpeta' | 'inactivos' | 'porContratar';

/** Evita `.trim()` sobre no-string (p. ej. número desde PostgREST), que rompe React con pantalla en blanco. */
function sTrim(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function nombreApellidoDesdeEmpleado(row: EmpleadoLite): { nombre: string; apellido: string } {
  const nombre = sTrim(row.nombres);
  const ap1 = sTrim(row.primer_apellido);
  const ap2 = sTrim(row.segundo_apellido);
  const apellido = [ap1, ap2].filter(Boolean).join(' ');
  if (nombre || apellido) {
    return { nombre: nombre || '—', apellido: apellido || '—' };
  }
  const full = sTrim(row.nombre_completo);
  const comma = full.indexOf(',');
  if (comma > 0) {
    return {
      apellido: full.slice(0, comma).trim() || '—',
      nombre: full.slice(comma + 1).trim() || '—',
    };
  }
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { nombre: parts.slice(0, -1).join(' '), apellido: parts[parts.length - 1] ?? '—' };
  }
  return { nombre: full || '—', apellido: '—' };
}

function cedulaDesdeEmpleado(row: EmpleadoLite): string {
  const v = sTrim(row.cedula ?? row.documento);
  return v || '—';
}

function telefonoDesdeEmpleado(row: EmpleadoLite): string {
  const v = sTrim(row.celular ?? row.telefono);
  return v || '—';
}

function oficioDesdeEmpleado(row: EmpleadoLite): string {
  const v = sTrim(row.cargo_nombre ?? row.cargo_codigo);
  return v || '—';
}

function mergePorId<T extends { id: string }>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(x.id, x);
  for (const x of b) {
    if (!m.has(x.id)) m.set(x.id, x);
  }
  return Array.from(m.values());
}

function plazasPorNecesidad(n: Pick<NeedLite, 'cantidad_requerida'>): number {
  const r = n.cantidad_requerida;
  if (typeof r === 'number' && Number.isFinite(r) && r >= 1) return Math.min(500, Math.floor(r));
  return 1;
}

function necesidadActiva(n: NeedLite): boolean {
  return n.protocol_active !== false;
}

function bucketContrato(estados: string[]): 'contratado_activo' | 'en_tramite' | 'sin_contrato' {
  const norm = estados.map((e) => (e ?? '').trim().toLowerCase()).filter(Boolean);
  if (norm.some((e) => e === 'firmado_activo')) return 'contratado_activo';
  if (norm.length > 0) return 'en_tramite';
  return 'sin_contrato';
}

function etiquetaBucket(b: ReturnType<typeof bucketContrato>): string {
  if (b === 'contratado_activo') return 'Contratado activo';
  if (b === 'en_tramite') return 'Contrato en trámite';
  return 'Sin contrato';
}

function statusEvaluacionCodigo(row: EmpleadoLite): string {
  return sTrim(row.status_evaluacion).toLowerCase();
}

function evaluacionAprobada(row: EmpleadoLite): boolean {
  return statusEvaluacionCodigo(row) === 'verde';
}

/** No aprobaron la evaluación (resultado explícito negativo). */
function evaluacionNoAprobada(row: EmpleadoLite): boolean {
  const s = statusEvaluacionCodigo(row);
  return s === 'rojo' || s === 'rechazado';
}

/** Contratado en firma activa sobre obra aún abierta (no cuenta como «inactivo por obra cerrada»). */
function tieneContratoActivoEnObraAbierta(
  eid: string,
  filasPorEmpleado: Map<string, FilaContratoObra[]>,
  obraEstadoPorId: Map<string, string>,
): boolean {
  const filas = filasPorEmpleado.get(eid) ?? [];
  for (const f of filas) {
    const oid = f.obra_id ? String(f.obra_id) : '';
    if (!oid) continue;
    const estObra = sTrim(obraEstadoPorId.get(oid)).toLowerCase();
    const ec = sTrim(f.estado_contrato).toLowerCase();
    if (ec === 'firmado_activo' && estObra === 'activa') return true;
  }
  return false;
}

/** Contratado en algún momento y la obra del contrato figura como cerrada; sin contrato activo en obra abierta. */
function esInactivoPorObraCulminada(
  eid: string,
  filasPorEmpleado: Map<string, FilaContratoObra[]>,
  obraEstadoPorId: Map<string, string>,
): boolean {
  const filas = filasPorEmpleado.get(eid) ?? [];
  if (filas.length === 0) return false;
  let hayContratoEnObraCerrada = false;
  for (const f of filas) {
    const oid = f.obra_id ? String(f.obra_id) : '';
    if (!oid) continue;
    const estObra = sTrim(obraEstadoPorId.get(oid)).toLowerCase();
    if (estObra === 'cerrada') {
      hayContratoEnObraCerrada = true;
      break;
    }
  }
  if (!hayContratoEnObraCerrada) return false;
  return !tieneContratoActivoEnObraAbierta(eid, filasPorEmpleado, obraEstadoPorId);
}

export default function ResumenObrerosProyectoModulo({
  proyectoModuloId,
  listaRefresco = 0,
  tabUrl = '',
}: ResumenObrerosProyectoModuloProps) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Obreros con asignación a solicitud de personal (`project_assignments`) en este módulo/proyectos hijos. */
  const [solicitadosPlazas, setSolicitadosPlazas] = useState(0);
  /** Plazas declaradas en vacantes activas (referencia). */
  const [plazasVacantesResumen, setPlazasVacantesResumen] = useState(0);
  const [vacantesActivas, setVacantesActivas] = useState(0);
  const [enCarpeta, setEnCarpeta] = useState(0);
  const [contratadosActivos, setContratadosActivos] = useState(0);
  const [empleados, setEmpleados] = useState<EmpleadoLite[]>([]);
  const [contratoPorEmpleado, setContratoPorEmpleado] = useState<Map<string, string[]>>(new Map());
  const [filasContratoPorEmpleado, setFilasContratoPorEmpleado] = useState<Map<string, FilaContratoObra[]>>(() => new Map());
  const [obraEstadoPorId, setObraEstadoPorId] = useState<Map<string, string>>(() => new Map());
  const [listaModal, setListaModal] = useState<ListaModalTipo | null>(null);
  const [viewportTick, setViewportTick] = useState(0);

  useEffect(() => {
    const bump = () => setViewportTick((t) => t + 1);
    const onVis = () => {
      if (document.visibilityState === 'visible') bump();
    };
    const onCustom = () => bump();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', bump);
    window.addEventListener('ci-resumen-obreros-refresh', onCustom);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', bump);
      window.removeEventListener('ci-resumen-obreros-refresh', onCustom);
    };
  }, []);

  useEffect(() => {
    const id = proyectoModuloId.trim();
    if (!id) {
      setLoading(false);
      setError('Proyecto no válido.');
      return;
    }

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const obraHijaIds = await idsObrasHijasDesdeModuloIntegral(supabase, id);
        if (!alive) return;

        const filtroModulo = `proyecto_modulo_id.eq.${id},proyecto_id.eq.${id}`;
        const selNeeds = 'id,cantidad_requerida,protocol_active,cargo_nombre,title,created_at';
        const r1 = await supabase.from('recruitment_needs').select(selNeeds).or(filtroModulo).order('created_at', { ascending: false });

        let needs: NeedLite[] = ((r1.data ?? []) as NeedLite[]).map((n) => ({
          ...n,
          cantidad_requerida: n.cantidad_requerida,
        }));

        if (obraHijaIds.length > 0) {
          const r2 = await supabase
            .from('recruitment_needs')
            .select(selNeeds)
            .in('proyecto_id', obraHijaIds)
            .order('created_at', { ascending: false });
          if (!alive) return;
          if (!r2.error && r2.data?.length) {
            needs = mergePorId(
              needs,
              r2.data as NeedLite[],
            );
          }
        }

        const needsActivas = needs.filter(necesidadActiva);
        const plazas = needsActivas.reduce((acc, n) => acc + plazasPorNecesidad(n), 0);
        const needIds = needsActivas.map((n) => n.id);

        const selEmp =
          'id,nombre_completo,nombres,primer_apellido,segundo_apellido,cedula,documento,celular,telefono,cargo_nombre,cargo_codigo,estado,estado_proceso,recruitment_need_id,status_evaluacion,created_at';
        const e1 = await supabase.from('ci_empleados').select(selEmp).eq('proyecto_modulo_id', id).order('nombre_completo');
        if (!alive) return;

        let emps: EmpleadoLite[] = (e1.data ?? []) as EmpleadoLite[];
        if (needIds.length > 0) {
          const e2 = await supabase.from('ci_empleados').select(selEmp).in('recruitment_need_id', needIds).order('nombre_completo');
          if (!alive) return;
          if (!e2.error && e2.data?.length) {
            emps = mergePorId(emps, e2.data as EmpleadoLite[]);
          }
        }

        if (obraHijaIds.length > 0) {
          const asg = await supabase.from('ci_obra_empleados').select('empleado_id').in('obra_id', obraHijaIds);
          if (!alive) return;
          if (!asg.error && asg.data?.length) {
            const asignados = Array.from(
              new Set(
                (asg.data ?? [])
                  .map((r) =>
                    typeof (r as { empleado_id?: unknown }).empleado_id === 'string'
                      ? (r as { empleado_id: string }).empleado_id
                      : '',
                  )
                  .filter(Boolean),
              ),
            );
            if (asignados.length > 0) {
              const e3 = await supabase.from('ci_empleados').select(selEmp).in('id', asignados).order('nombre_completo');
              if (!alive) return;
              if (!e3.error && e3.data?.length) {
                emps = mergePorId(emps, e3.data as EmpleadoLite[]);
              }
            }
          }
        }

        /** Obreros asignados vía `project_assignments` (solicitud de personal); suelen no tener `proyecto_modulo_id`. */
        const projectIdsAsignacion = Array.from(new Set([id, ...obraHijaIds]));
        const solicitadosIds = new Set<string>();
        const { data: pasg, error: pasgErr } = await supabase
          .from('project_assignments')
          .select('worker_id')
          .in('project_id', projectIdsAsignacion);
        if (!alive) return;
        if (!pasgErr && pasg?.length) {
          for (const r of pasg ?? []) {
            const wid = typeof (r as { worker_id?: unknown }).worker_id === 'string' ? (r as { worker_id: string }).worker_id : '';
            if (wid) solicitadosIds.add(wid);
          }
          const conocidos = new Set(emps.map((e) => e.id));
          const workerIds = Array.from(solicitadosIds).filter((wid) => !conocidos.has(wid));
          if (workerIds.length > 0) {
            const e4 = await supabase.from('ci_empleados').select(selEmp).in('id', workerIds).order('nombre_completo');
            if (!alive) return;
            if (!e4.error && e4.data?.length) {
              emps = mergePorId(emps, e4.data as EmpleadoLite[]);
            }
          }
        }

        emps.sort((a, b) =>
          sTrim(a.nombre_completo).localeCompare(sTrim(b.nombre_completo), 'es', { sensitivity: 'base' }),
        );

        const empIds = emps.map((e) => e.id);
        const contrMap = new Map<string, string[]>();
        const filasContratoPorEmpleado = new Map<string, FilaContratoObra[]>();
        if (empIds.length > 0) {
          const ctr = await supabase
            .from('ci_contratos_empleado_obra')
            .select('empleado_id,estado_contrato,obra_id')
            .in('empleado_id', empIds);
          if (!alive) return;
          for (const row of ctr.data ?? []) {
            const eid = String((row as { empleado_id?: unknown }).empleado_id ?? '');
            const st = String((row as { estado_contrato?: unknown }).estado_contrato ?? '');
            const oidRaw = (row as { obra_id?: unknown }).obra_id;
            const obra_id = typeof oidRaw === 'string' && oidRaw ? oidRaw : null;
            if (!eid) continue;
            const arr = contrMap.get(eid) ?? [];
            arr.push(st);
            contrMap.set(eid, arr);
            const det = filasContratoPorEmpleado.get(eid) ?? [];
            det.push({ obra_id, estado_contrato: st });
            filasContratoPorEmpleado.set(eid, det);
          }
        }

        const obraIdsContratos = new Set<string>();
        for (const filas of Array.from(filasContratoPorEmpleado.values())) {
          for (const f of filas) {
            if (f.obra_id) obraIdsContratos.add(f.obra_id);
          }
        }
        const obraEstadoMap = new Map<string, string>();
        if (obraIdsContratos.size > 0) {
          const { data: obrasRows, error: obrasErr } = await supabase
            .from('ci_obras')
            .select('id,estado')
            .in('id', Array.from(obraIdsContratos));
          if (!alive) return;
          if (!obrasErr && obrasRows?.length) {
            for (const orow of obrasRows as { id?: unknown; estado?: unknown }[]) {
              const oid = typeof orow.id === 'string' ? orow.id : '';
              if (!oid) continue;
              obraEstadoMap.set(oid, sTrim(orow.estado));
            }
          }
        }

        const activos = emps.filter((e) => bucketContrato(contrMap.get(e.id) ?? []) === 'contratado_activo').length;
        const enCarpetaEval = emps.filter((e) => evaluacionNoAprobada(e)).length;
        const solicitadosEnLista = emps.filter((e) => solicitadosIds.has(e.id)).length;

        emps = emps.map((row) => ({
          ...row,
          status_evaluacion: (row as { status_evaluacion?: string | null }).status_evaluacion ?? null,
        })) as EmpleadoLite[];

        if (!alive) return;
        setPlazasVacantesResumen(plazas);
        setSolicitadosPlazas(solicitadosEnLista);
        setVacantesActivas(needsActivas.length);
        setEnCarpeta(enCarpetaEval);
        setContratadosActivos(activos);
        setEmpleados(emps);
        setContratoPorEmpleado(contrMap);
        setFilasContratoPorEmpleado(new Map(filasContratoPorEmpleado));
        setObraEstadoPorId(new Map(obraEstadoMap));
      } catch {
        if (!alive) return;
        setError('No se pudo cargar el resumen de obreros.');
        setSolicitadosPlazas(0);
        setPlazasVacantesResumen(0);
        setVacantesActivas(0);
        setEnCarpeta(0);
        setContratadosActivos(0);
        setEmpleados([]);
        setContratoPorEmpleado(new Map());
        setFilasContratoPorEmpleado(new Map());
        setObraEstadoPorId(new Map());
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [proyectoModuloId, supabase, listaRefresco, viewportTick, tabUrl]);

  const porContratarObrerosCount = useMemo(
    () =>
      empleados.filter(
        (e) => evaluacionAprobada(e) && bucketContrato(contratoPorEmpleado.get(e.id) ?? []) !== 'contratado_activo',
      ).length,
    [empleados, contratoPorEmpleado],
  );

  const contratadosInactivos = useMemo(
    () =>
      empleados.filter((e) => esInactivoPorObraCulminada(e.id, filasContratoPorEmpleado, obraEstadoPorId)).length,
    [empleados, filasContratoPorEmpleado, obraEstadoPorId],
  );

  const filasListaModal = useMemo(() => {
    if (!listaModal) return [];
    return empleados.filter((e) => {
      const b = bucketContrato(contratoPorEmpleado.get(e.id) ?? []);
      switch (listaModal) {
        case 'enCarpeta':
          return evaluacionNoAprobada(e);
        case 'inactivos':
          return esInactivoPorObraCulminada(e.id, filasContratoPorEmpleado, obraEstadoPorId);
        case 'porContratar':
          return evaluacionAprobada(e) && b !== 'contratado_activo';
        default:
          return false;
      }
    });
  }, [listaModal, empleados, contratoPorEmpleado, filasContratoPorEmpleado, obraEstadoPorId]);

  const tituloListaModal = useMemo(() => {
    switch (listaModal) {
      case 'enCarpeta':
        return 'En carpeta (evaluación no aprobada)';
      case 'inactivos':
        return 'Contratados inactivos (obra culminada)';
      case 'porContratar':
        return 'Por contratar (evaluación aprobada, sin contrato activo)';
      default:
        return '';
    }
  }, [listaModal]);

  return (
    <section
      className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-b from-fuchsia-950/40 to-zinc-950/80 p-5 shadow-[0_0_32px_rgba(192,38,211,0.08)] backdrop-blur-xl"
      aria-labelledby="resumen-obreros-proyecto-titulo"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/15">
            <Users className="h-5 w-5 text-fuchsia-200" aria-hidden />
          </div>
          <div>
            <h2 id="resumen-obreros-proyecto-titulo" className="text-base font-bold tracking-tight text-white">
              Cuadro de obreros — RRHH del proyecto
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Plazas solicitadas, personas en carpeta del proyecto y contratos activos en obra vinculada.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Link
            href={`/proyectos/nuevo?desde=proyecto&proyecto_modulo_id=${encodeURIComponent(proyectoModuloId)}`}
            className="rounded-lg border border-sky-500/45 bg-sky-500/15 px-3 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/25"
            title="Nueva solicitud de personal vinculada a este proyecto integral"
          >
            Solicitar personal
          </Link>
          <Link
            href="/rrhh/hojas-vida"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-100 hover:bg-white/10"
          >
            Hojas de vida RRHH
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Cargando resumen…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Link
              href="/rrhh/gestion-personal"
              className="block w-full rounded-xl border border-[#FF9500]/35 bg-[#FF9500]/10 p-4 text-left transition hover:border-[#FF9500]/55 hover:bg-[#FF9500]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9500]/50"
              title="Gestionar solicitudes de personal y asignaciones (RRHH)"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#FF9500]/90">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                Solicitados
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{solicitadosPlazas}</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                Asignados a solicitud de personal. Ref.: {plazasVacantesResumen} plaza(s) en {vacantesActivas} vacante(s).
                Clic: ir a gestión de personal RRHH.
              </p>
            </Link>
            <button
              type="button"
              onClick={() => setListaModal('enCarpeta')}
              className="w-full rounded-xl border border-sky-500/35 bg-sky-500/10 p-4 text-left transition hover:border-sky-400/50 hover:bg-sky-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-sky-300/90">
                <Users className="h-3.5 w-3.5" aria-hidden />
                En carpeta
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{enCarpeta}</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                Resultado «rojo» o «rechazado» en status_evaluacion. Clic: lista.
              </p>
            </button>
            <Link
              href="/rrhh/gestion-personal?tab=obra"
              className="block w-full rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
              title="Ver personal en obra y asignaciones en RRHH"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-300/90">
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                Contratados activos
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{contratadosActivos}</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                Contrato obra «firmado activo» en este resumen. Clic: ir a gestión de personal RRHH.
              </p>
            </Link>
            <button
              type="button"
              onClick={() => setListaModal('inactivos')}
              className="w-full rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-left transition hover:border-rose-400/50 hover:bg-rose-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-rose-200/90">
                <UserX className="h-3.5 w-3.5" aria-hidden />
                Contratados inactivos
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{contratadosInactivos}</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                Contrato vinculado a obra en estado «cerrada» y sin contrato activo en obra abierta. Clic: lista.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setListaModal('porContratar')}
              className="w-full rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-left transition hover:border-amber-400/50 hover:bg-amber-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
                <UserMinus className="h-3.5 w-3.5" aria-hidden />
                Por contratar
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{porContratarObrerosCount}</p>
              <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                Evaluación aprobada (verde) y aún sin contrato obra «firmado activo». Clic: lista.
              </p>
            </button>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2.5">Obrero</th>
                  <th className="px-3 py-2.5">Cargo</th>
                  <th className="px-3 py-2.5">Proceso</th>
                  <th className="px-3 py-2.5">Contrato</th>
                </tr>
              </thead>
              <tbody>
                {empleados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                      Aún no hay postulantes vinculados a este proyecto. Los registros por enlace de vacante
                      aparecerán aquí.
                    </td>
                  </tr>
                ) : (
                  empleados.map((row) => {
                    const bucket = bucketContrato(contratoPorEmpleado.get(row.id) ?? []);
                    return (
                      <tr key={row.id} className="border-b border-white/[0.06] hover:bg-white/5">
                        <td className="px-3 py-2.5 font-medium text-zinc-100">
                          <Link
                            href={`/empleados/${encodeURIComponent(row.id)}`}
                            className="text-sky-300 underline decoration-sky-500/40 hover:text-sky-200"
                          >
                            {sTrim(row.nombre_completo) || 'Sin nombre'}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-300">{sTrim(row.cargo_nombre) || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-zinc-400">
                          {sTrim(row.estado_proceso ?? row.estado) || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={
                              bucket === 'contratado_activo'
                                ? 'inline-flex rounded-full border border-emerald-500/45 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200'
                                : bucket === 'en_tramite'
                                  ? 'inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100'
                                  : 'inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-zinc-400'
                            }
                          >
                            {etiquetaBucket(bucket)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Dialog open={listaModal !== null} onOpenChange={(open) => !open && setListaModal(null)}>
            <DialogContent className="max-h-[85vh] overflow-hidden border-fuchsia-500/20 bg-zinc-950 p-0 sm:max-w-[min(96vw,900px)]">
              <DialogHeader className="border-b border-white/10 px-5 py-4 pr-12">
                <DialogTitle className="text-base">{tituloListaModal || 'Listado'}</DialogTitle>
                {(listaModal === 'porContratar' || listaModal === 'enCarpeta' || listaModal === 'inactivos') && (
                  <p className="text-xs text-zinc-500">
                    {listaModal === 'enCarpeta' &&
                      'Criterio: status_evaluacion «rojo» o «rechazado» (evaluación presentada y no aprobada).'}
                    {listaModal === 'porContratar' &&
                      'Criterio: evaluación «verde» y sin estado de contrato obra «firmado_activo» en este resumen.'}
                    {listaModal === 'inactivos' &&
                      'Criterio: al menos un contrato obra cuya obra está «cerrada» en ci_obras, y sin contrato activo en obra «activa».'}
                  </p>
                )}
              </DialogHeader>
              <div className="max-h-[60vh] overflow-auto px-2 pb-4 sm:px-4">
                {filasListaModal.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-zinc-500">No hay registros en esta categoría.</p>
                ) : (
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Nombre</th>
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Apellido</th>
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Cédula</th>
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Teléfono</th>
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Oficio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasListaModal.map((row) => {
                        const { nombre, apellido } = nombreApellidoDesdeEmpleado(row);
                        return (
                          <tr key={row.id} className="border-b border-white/[0.06] hover:bg-white/5">
                            <td className="px-3 py-2 font-medium text-zinc-100">
                              <Link
                                href={`/empleados/${encodeURIComponent(row.id)}`}
                                className="text-sky-300 underline decoration-sky-500/40 hover:text-sky-200"
                              >
                                {nombre}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-zinc-200">{apellido}</td>
                            <td className="px-3 py-2 tabular-nums text-zinc-300">{cedulaDesdeEmpleado(row)}</td>
                            <td className="px-3 py-2 tabular-nums text-zinc-300">{telefonoDesdeEmpleado(row)}</td>
                            <td className="px-3 py-2 text-zinc-300">{oficioDesdeEmpleado(row)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}
