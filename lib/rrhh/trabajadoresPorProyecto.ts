import type { SupabaseClient } from '@supabase/supabase-js';
import { etiquetaEstadoArchivo, type EmpleadoHojaVidaRow } from '@/lib/rrhh/fetchEmpleadosHojasVida';

export type ProyectoTrabajadorOpcion = {
  id: string;
  nombre: string;
};

export type TrabajadorPorProyectoRow = EmpleadoHojaVidaRow & {
  /** Proyectos u obras (`ci_proyectos.id`) vinculados al trabajador. */
  proyectoIds: string[];
  /** Nombres legibles, mismo orden que `proyectoIds`. */
  proyectoNombres: string[];
};

const COLS_EMP =
  'id,nombre_completo,documento,cedula,celular,telefono,created_at,estado_proceso,estado,estatus,cargo_nombre,recruitment_need_id,proyecto_modulo_id,status_evaluacion,semaforo,examen_completado_at';

const COLS_EMP_MIN =
  'id,nombre_completo,documento,cedula,celular,telefono,created_at,estado_proceso,estado,estatus,cargo_nombre,recruitment_need_id,proyecto_modulo_id';

function s(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function uniq(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

export { etiquetaEstadoArchivo };

export async function fetchTrabajadoresTodosProyectos(
  supabase: SupabaseClient,
): Promise<{
  proyectos: ProyectoTrabajadorOpcion[];
  trabajadores: TrabajadorPorProyectoRow[];
  error: string | null;
}> {
  const proyRes = await supabase
    .from('ci_proyectos')
    .select('id,nombre,tipo_proyecto,proyecto_modulo_origen_id')
    .order('nombre', { ascending: true })
    .limit(500);

  if (proyRes.error) {
    return { proyectos: [], trabajadores: [], error: proyRes.error.message };
  }

  type ProyRow = {
    id: string;
    nombre?: string | null;
    proyecto_modulo_origen_id?: string | null;
  };
  const proyRows = (proyRes.data ?? []) as ProyRow[];
  const nombreById = new Map<string, string>();
  const moduloPadreByObraId = new Map<string, string>();
  for (const p of proyRows) {
    const id = s(p.id);
    if (!id) continue;
    nombreById.set(id, s(p.nombre) || 'Sin nombre');
    const padre = s(p.proyecto_modulo_origen_id);
    if (padre) moduloPadreByObraId.set(id, padre);
  }

  const proyectos: ProyectoTrabajadorOpcion[] = proyRows
    .map((p) => ({ id: s(p.id), nombre: nombreById.get(s(p.id)) ?? 'Sin nombre' }))
    .filter((p) => p.id);

  const empFull = await supabase
    .from('ci_empleados')
    .select(COLS_EMP)
    .order('nombre_completo', { ascending: true })
    .limit(2500);

  let empleados: EmpleadoHojaVidaRow[] = [];
  if (!empFull.error && empFull.data) {
    empleados = empFull.data as EmpleadoHojaVidaRow[];
  } else {
    const empMin = await supabase
      .from('ci_empleados')
      .select(COLS_EMP_MIN)
      .order('nombre_completo', { ascending: true })
      .limit(2500);
    if (empMin.error) {
      return { proyectos, trabajadores: [], error: empMin.error.message };
    }
    empleados = (empMin.data ?? []) as EmpleadoHojaVidaRow[];
  }
  const proyectoIdsPorWorker = new Map<string, Set<string>>();

  const addProyecto = (workerId: string, proyectoId: string) => {
    const wid = s(workerId);
    const pid = s(proyectoId);
    if (!wid || !pid) return;
    let set = proyectoIdsPorWorker.get(wid);
    if (!set) {
      set = new Set();
      proyectoIdsPorWorker.set(wid, set);
    }
    set.add(pid);
    const padre = moduloPadreByObraId.get(pid);
    if (padre) set.add(padre);
  };

  for (const e of empleados) {
    if (e.proyecto_modulo_id) addProyecto(e.id, e.proyecto_modulo_id);
  }

  const needIds = uniq(empleados.map((e) => s(e.recruitment_need_id)).filter(Boolean));
  if (needIds.length > 0) {
    const needRes = await supabase
      .from('recruitment_needs')
      .select('id,proyecto_modulo_id,proyecto_id')
      .in('id', needIds.slice(0, 400));
    if (!needRes.error && needRes.data?.length) {
      const needProyById = new Map<string, { mod?: string; pr?: string }>();
      for (const n of needRes.data as {
        id?: string;
        proyecto_modulo_id?: string | null;
        proyecto_id?: string | null;
      }[]) {
        const nid = s(n.id);
        if (!nid) continue;
        needProyById.set(nid, { mod: s(n.proyecto_modulo_id), pr: s(n.proyecto_id) });
      }
      for (const e of empleados) {
        const nid = s(e.recruitment_need_id);
        if (!nid) continue;
        const np = needProyById.get(nid);
        if (np?.mod) addProyecto(e.id, np.mod);
        if (np?.pr) addProyecto(e.id, np.pr);
      }
    }
  }

  const asgRes = await supabase.from('project_assignments').select('worker_id,project_id').limit(8000);
  if (!asgRes.error && asgRes.data?.length) {
    for (const a of asgRes.data as { worker_id?: string; project_id?: string }[]) {
      addProyecto(s(a.worker_id), s(a.project_id));
    }
  }

  const obraRes = await supabase.from('ci_obra_empleados').select('empleado_id,obra_id').limit(8000);
  if (!obraRes.error && obraRes.data?.length) {
    for (const o of obraRes.data as { empleado_id?: string; obra_id?: string }[]) {
      addProyecto(s(o.empleado_id), s(o.obra_id));
    }
  }

  const trabajadores: TrabajadorPorProyectoRow[] = empleados.map((e) => {
    const ids = Array.from(proyectoIdsPorWorker.get(e.id) ?? []);
    ids.sort((a, b) =>
      (nombreById.get(a) ?? a).localeCompare(nombreById.get(b) ?? b, 'es', { sensitivity: 'base' }),
    );
    return {
      ...e,
      proyectoIds: ids,
      proyectoNombres: ids.map((id) => nombreById.get(id) ?? id.slice(0, 8)),
    };
  });

  return { proyectos, trabajadores, error: null };
}

export function filtrarTrabajadoresPorProyecto(
  rows: TrabajadorPorProyectoRow[],
  proyectoId: string | null,
  busqueda: string,
): TrabajadorPorProyectoRow[] {
  const q = busqueda.trim().toLowerCase();
  const pid = (proyectoId ?? '').trim();

  return rows.filter((r) => {
    if (pid === '__sin_proyecto__') {
      if (r.proyectoIds.length > 0) return false;
    } else if (pid) {
      if (!r.proyectoIds.includes(pid)) return false;
    }
    if (!q) return true;
    const nombre = (r.nombre_completo ?? '').toLowerCase();
    const doc = `${r.cedula ?? ''} ${r.documento ?? ''}`.toLowerCase();
    const cargo = (r.cargo_nombre ?? '').toLowerCase();
    const proys = r.proyectoNombres.join(' ').toLowerCase();
    return nombre.includes(q) || doc.includes(q) || cargo.includes(q) || proys.includes(q);
  });
}
