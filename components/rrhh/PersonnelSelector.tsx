'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { coincideEspecialidad, esObreroDisponible } from '@/lib/rrhh/laborPersonnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type PersonnelSelectorProps = {
  /** UUID de `labor_requests.id` (solicitud). */
  laborRequestId: string;
  /** UUID de `ci_proyectos.id` — debe coincidir con `labor_requests.project_id`. */
  projectId: string;
  /**
   * Tras asignar, navegación (por defecto cuadro de obreros del módulo).
   * Usa el id del módulo integral si difiere del `project_id` de la solicitud.
   */
  redirectAfterAssignHref?: string;
  className?: string;
  onAssigned?: () => void;
};

type LaborRequestRow = {
  id: string;
  project_id: string;
  specialty_codigo: string;
  specialty_nombre: string | null;
  quantity_requested: number;
  status: string;
};

type EmpleadoPersonnel = {
  id: string;
  nombre_completo: string | null;
  cargo_codigo: string | null;
  cargo_nombre: string | null;
  estado: string | null;
  estatus: string | null;
  rol_examen: string | null;
};

function sTrim(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function iniciales(nombre: string): string {
  const p = nombre.split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0] + p[p.length - 1]![0]).toUpperCase();
}

async function contarAsignacionesEnSolicitud(
  supabase: ReturnType<typeof createClient>,
  laborRequestId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('project_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('labor_request_id', laborRequestId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Selector de personal para asignar a una `labor_requests`.
 *
 * Fuente de datos: `ci_empleados` (obreros aprobados/disponibles), alineado con RRHH.
 * En BD, `project_assignments` usa `worker_id` + `labor_request_id` (no `persons` / `cv_data` hasta existan).
 * Asignación activa: fila con `end_date` nulo (tras migración 106); si la columna no existe aún, se excluye
 * cualquier fila en `project_assignments` para ese trabajador.
 */
export default function PersonnelSelector({
  laborRequestId,
  projectId,
  redirectAfterAssignHref,
  className = '',
  onAssigned,
}: PersonnelSelectorProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loadingReq, setLoadingReq] = useState(true);
  const [reqError, setReqError] = useState<string | null>(null);
  const [request, setRequest] = useState<LaborRequestRow | null>(null);

  const [loadingPeople, setLoadingPeople] = useState(false);
  const [people, setPeople] = useState<EmpleadoPersonnel[]>([]);
  const [assignedHereIds, setAssignedHereIds] = useState<Set<string>>(new Set());
  const [hasEndDateColumn, setHasEndDateColumn] = useState(true);

  const [search, setSearch] = useState('');
  const [onlySpecialty, setOnlySpecialty] = useState(true);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const destinoTrasAsignar = useMemo(
    () =>
      redirectAfterAssignHref?.trim() ||
      `/proyectos/modulo/${encodeURIComponent(projectId)}?tab=solicitados`,
    [redirectAfterAssignHref, projectId],
  );

  const solicitudCerrada = useMemo(() => {
    const st = sTrim(request?.status).toLowerCase();
    return st === 'fulfilled' || st === 'cancelled';
  }, [request]);

  const cupoRestante = useMemo(() => {
    if (!request) return 0;
    const q =
      typeof request.quantity_requested === 'number' && Number.isFinite(request.quantity_requested)
        ? Math.max(1, Math.min(500, Math.floor(request.quantity_requested)))
        : 1;
    return Math.max(0, q - assignedHereIds.size);
  }, [request, assignedHereIds]);

  const cargarSolicitud = useCallback(async () => {
    const lid = laborRequestId.trim();
    const pid = projectId.trim();
    if (!lid || !pid) {
      setReqError('Solicitud o proyecto no válidos.');
      setLoadingReq(false);
      return;
    }
    setLoadingReq(true);
    setReqError(null);
    const { data, error } = await supabase
      .from('labor_requests')
      .select('id,project_id,specialty_codigo,specialty_nombre,quantity_requested,status')
      .eq('id', lid)
      .maybeSingle();
    setLoadingReq(false);
    if (error) {
      setReqError(error.message);
      setRequest(null);
      return;
    }
    const row = data as LaborRequestRow | null;
    if (!row) {
      setReqError('No se encontró la solicitud.');
      setRequest(null);
      return;
    }
    if (sTrim(row.project_id) !== pid) {
      setReqError('El project_id no coincide con la solicitud.');
      setRequest(null);
      return;
    }
    setRequest(row);
  }, [laborRequestId, projectId, supabase]);

  const cargarPersonal = useCallback(async () => {
    if (!request) return;
    setLoadingPeople(true);
    try {
      const selEmp =
        'id,nombre_completo,cargo_codigo,cargo_nombre,estado,estatus,rol_examen,created_at';
      const { data: emps, error: e1 } = await supabase
        .from('ci_empleados')
        .select(selEmp)
        .eq('rol_examen', 'obrero')
        .eq('estado', 'aprobado')
        .or('estatus.is.null,estatus.eq.disponible')
        .order('nombre_completo');
      if (e1) throw new Error(e1.message);

      const asgRes = await supabase.from('project_assignments').select('worker_id,end_date');
      let activosPorWorker = new Set<string>();
      if (asgRes.error) {
        const msg = (asgRes.error.message ?? '').toLowerCase();
        if (msg.includes('end_date') || msg.includes('column')) {
          setHasEndDateColumn(false);
          /** Sin `end_date` no inferimos “ocupado global”; solo excluimos duplicados en esta solicitud. */
        } else throw new Error(asgRes.error.message);
      } else {
        setHasEndDateColumn(true);
        for (const r of (asgRes.data ?? []) as { worker_id?: string; end_date?: string | null }[]) {
          const wid = sTrim(r.worker_id);
          if (!wid) continue;
          const fin = r.end_date;
          if (fin == null || sTrim(fin) === '') activosPorWorker.add(wid);
        }
      }

      const yaEnEsta = new Set(
        (
          await supabase.from('project_assignments').select('worker_id').eq('labor_request_id', request.id)
        ).data?.map((r) => sTrim((r as { worker_id: string }).worker_id)) ?? [],
      );
      setAssignedHereIds(yaEnEsta);

      const list = ((emps ?? []) as EmpleadoPersonnel[]).filter((row) => {
        if (!esObreroDisponible(row)) return false;
        if (yaEnEsta.has(row.id)) return false;
        if (activosPorWorker.has(row.id)) return false;
        return true;
      });
      setPeople(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar personal.');
      setPeople([]);
    } finally {
      setLoadingPeople(false);
    }
  }, [request, supabase]);

  useEffect(() => {
    void cargarSolicitud();
  }, [cargarSolicitud]);

  useEffect(() => {
    if (request) void cargarPersonal();
  }, [request, cargarPersonal]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      const nombre = sTrim(p.nombre_completo).toLowerCase();
      if (q && !nombre.includes(q)) return false;
      if (onlySpecialty && request && !coincideEspecialidad(request.specialty_codigo, p)) return false;
      return true;
    });
  }, [people, search, onlySpecialty, request]);

  async function confirmarAsignacion() {
    if (!request || !selectedWorkerId || solicitudCerrada) return;
    if (cupoRestante <= 0) {
      toast.error('No hay cupo disponible en esta solicitud.');
      return;
    }
    setSubmitting(true);
    try {
      const insertPayload: Record<string, unknown> = {
        labor_request_id: request.id,
        worker_id: selectedWorkerId,
        project_id: request.project_id,
      };
      if (hasEndDateColumn) {
        insertPayload.start_date = new Date().toISOString();
        insertPayload.end_date = null;
      }

      const { error: ins } = await supabase.from('project_assignments').insert(
        insertPayload as {
          labor_request_id: string;
          worker_id: string;
          project_id: string;
          start_date?: string;
          end_date?: string | null;
        },
      );
      if (ins) throw new Error(ins.message);

      const { error: up } = await supabase.from('ci_empleados').update({ estatus: 'asignado' }).eq('id', selectedWorkerId);
      if (up) throw new Error(up.message);

      const total = (await contarAsignacionesEnSolicitud(supabase, request.id)) ?? 0;
      const qty =
        typeof request.quantity_requested === 'number' && Number.isFinite(request.quantity_requested)
          ? Math.max(1, Math.min(500, Math.floor(request.quantity_requested)))
          : 1;
      if (total >= qty) {
        const { error: fu } = await supabase
          .from('labor_requests')
          .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
          .eq('id', request.id);
        if (fu) throw new Error(fu.message);
      }

      toast.success('Personal asignado correctamente.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
      }
      onAssigned?.();
      router.refresh();
      router.push(destinoTrasAsignar);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingReq) {
    return (
      <div className={`rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-sm text-zinc-400 ${className}`}>
        Cargando solicitud…
      </div>
    );
  }

  if (reqError || !request) {
    return (
      <div className={`rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200 ${className}`}>
        {reqError ?? 'Solicitud no disponible.'}
      </div>
    );
  }

  return (
    <div className={`space-y-4 rounded-xl border border-fuchsia-500/20 bg-zinc-950/80 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-300/90">Asignación</p>
          <p className="mt-1 text-sm font-semibold text-white">
            Especialidad: <span className="text-fuchsia-100">{sTrim(request.specialty_codigo)}</span>
            {request.specialty_nombre ? (
              <span className="text-zinc-400"> · {sTrim(request.specialty_nombre)}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Estado solicitud: <span className="font-mono text-zinc-300">{sTrim(request.status)}</span> · Cupo:{' '}
            <span className="tabular-nums text-zinc-200">{cupoRestante}</span> libre(s)
            {!hasEndDateColumn ? (
              <span className="ml-1 text-amber-400/90">
                · Aplica migración 106 para distinguir asignaciones activas (`end_date`).
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Buscar nombre</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre…"
            className="mt-1 border-white/10 bg-white/5 text-white"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={onlySpecialty}
            onChange={(e) => setOnlySpecialty(e.target.checked)}
            className="rounded border-white/20"
          />
          Solo cargo compatible con la solicitud
        </label>
      </div>

      {loadingPeople ? (
        <p className="text-sm text-zinc-500">Cargando candidatos…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay personal disponible que coincida con los filtros.</p>
      ) : (
        <ul className="max-h-[min(52vh,420px)] space-y-1 overflow-y-auto pr-1">
          {filtrados.map((p) => {
            const nombre = sTrim(p.nombre_completo) || 'Sin nombre';
            const cargo = sTrim(p.cargo_nombre ?? p.cargo_codigo) || '—';
            const sel = selectedWorkerId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={solicitudCerrada}
                  onClick={() => setSelectedWorkerId(p.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    sel
                      ? 'border-fuchsia-400/60 bg-fuchsia-500/15'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  } disabled:opacity-40`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-fuchsia-600/40 to-zinc-800 text-xs font-bold text-white">
                    {iniciales(nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{nombre}</span>
                    <span className="block truncate text-xs text-zinc-400">{cargo}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-3">
        <Button
          type="button"
          variant="secondary"
          className="border-white/15 bg-white/5"
          disabled={submitting}
          onClick={() => router.push(destinoTrasAsignar)}
        >
          Volver al cuadro
        </Button>
        <Button
          type="button"
          className="bg-fuchsia-600 text-white hover:bg-fuchsia-500"
          disabled={solicitudCerrada || !selectedWorkerId || cupoRestante <= 0 || submitting}
          onClick={() => void confirmarAsignacion()}
        >
          {submitting ? 'Procesando…' : 'Confirmar asignación'}
        </Button>
      </div>
    </div>
  );
}
