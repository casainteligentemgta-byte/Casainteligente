import type { SupabaseClient } from '@supabase/supabase-js';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';
import { normCedulaToken } from '@/lib/talento/cedulaAuth';

export type FilaNominaContratado = {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  bonoUsd: number;
  fechaIngreso: string | null;
};

function sTrim(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function cedulaNorm(raw: string): string {
  if (!raw.trim()) return '';
  try {
    return normCedulaToken(raw);
  } catch {
    return raw.replace(/\s/g, '').toLowerCase();
  }
}

function apellidosDesdeEmpleado(row: {
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  nombre_completo?: string | null;
  nombres?: string | null;
}): string {
  const ap1 = sTrim(row.primer_apellido);
  const ap2 = sTrim(row.segundo_apellido);
  const joined = [ap1, ap2].filter(Boolean).join(' ');
  if (joined) return joined;
  const full = sTrim(row.nombre_completo);
  const comma = full.indexOf(',');
  if (comma > 0) return full.slice(0, comma).trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1] ?? '';
  return '';
}

function nombresDesdeEmpleado(row: {
  nombres?: string | null;
  nombre_completo?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
}): string {
  const n = sTrim(row.nombres);
  if (n) return n;
  const full = sTrim(row.nombre_completo);
  const comma = full.indexOf(',');
  if (comma > 0) return full.slice(comma + 1).trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, -1).join(' ');
  return full;
}

async function projectIdsAlcance(
  supabase: SupabaseClient,
  proyectoModuloId?: string,
): Promise<string[] | null> {
  const pid = proyectoModuloId?.trim();
  if (!pid) return null;
  const hijas = await idsObrasHijasDesdeModuloIntegral(supabase, pid);
  return Array.from(new Set([pid, ...hijas]));
}

export async function fetchCuadroContratados(
  supabase: SupabaseClient,
  opts?: { proyectoModuloId?: string },
): Promise<FilaNominaContratado[]> {
  const projectIds = await projectIdsAlcance(supabase, opts?.proyectoModuloId);

  let contratosQuery = supabase
    .from('ci_contratos_empleado_obra')
    .select('empleado_id,fecha_ingreso,obra_id,estado_contrato,created_at')
    .eq('estado_contrato', 'firmado_activo');

  if (projectIds?.length) {
    contratosQuery = contratosQuery.in('obra_id', projectIds);
  }

  const { data: contratos, error: cErr } = await contratosQuery;
  if (cErr) throw new Error(cErr.message);

  const empleadoIds = Array.from(
    new Set(
      (contratos ?? [])
        .map((r) => sTrim((r as { empleado_id?: unknown }).empleado_id))
        .filter(Boolean),
    ),
  );

  const fechaIngresoPorEmpleado = new Map<string, string>();
  for (const raw of contratos ?? []) {
    const eid = sTrim((raw as { empleado_id?: unknown }).empleado_id);
    if (!eid) continue;
    const fi = sTrim((raw as { fecha_ingreso?: unknown }).fecha_ingreso);
    if (fi && !fechaIngresoPorEmpleado.has(eid)) {
      fechaIngresoPorEmpleado.set(eid, fi.slice(0, 10));
    }
  }

  const empleadosMap = new Map<
    string,
    {
      nombres: string;
      apellidos: string;
      cedula: string;
      cedulaNorm: string;
    }
  >();

  if (empleadoIds.length > 0) {
    const { data: emps, error: eErr } = await supabase
      .from('ci_empleados')
      .select(
        'id,nombres,primer_apellido,segundo_apellido,nombre_completo,cedula,documento',
      )
      .in('id', empleadoIds);
    if (eErr) throw new Error(eErr.message);

    for (const raw of emps ?? []) {
      const id = sTrim((raw as { id?: unknown }).id);
      if (!id) continue;
      const cedula = sTrim((raw as { cedula?: unknown }).cedula ?? (raw as { documento?: unknown }).documento);
      empleadosMap.set(id, {
        nombres: nombresDesdeEmpleado(raw as Parameters<typeof nombresDesdeEmpleado>[0]),
        apellidos: apellidosDesdeEmpleado(raw as Parameters<typeof apellidosDesdeEmpleado>[0]),
        cedula: cedula || '—',
        cedulaNorm: cedulaNorm(cedula),
      });
    }
  }

  const bonoPorEmpleado = new Map<string, number>();
  if (empleadoIds.length > 0) {
    let asgQuery = supabase
      .from('project_assignments')
      .select('worker_id,bono_usd,created_at')
      .in('worker_id', empleadoIds)
      .order('created_at', { ascending: false });
    if (projectIds?.length) asgQuery = asgQuery.in('project_id', projectIds);
    const { data: asgRows } = await asgQuery;
    for (const raw of asgRows ?? []) {
      const wid = sTrim((raw as { worker_id?: unknown }).worker_id);
      if (!wid || bonoPorEmpleado.has(wid)) continue;
      const b = Number((raw as { bono_usd?: unknown }).bono_usd);
      bonoPorEmpleado.set(wid, Number.isFinite(b) ? Math.max(0, Math.round(b * 100) / 100) : 0);
    }

    let oeQuery = supabase
      .from('ci_obra_empleados')
      .select('empleado_id,honorarios_acordados_usd')
      .in('empleado_id', empleadoIds);
    if (projectIds?.length) oeQuery = oeQuery.in('obra_id', projectIds);
    const { data: oeRows } = await oeQuery;
    for (const raw of oeRows ?? []) {
      const eid = sTrim((raw as { empleado_id?: unknown }).empleado_id);
      if (!eid) continue;
      const prev = bonoPorEmpleado.get(eid) ?? 0;
      if (prev > 0) continue;
      const h = Number((raw as { honorarios_acordados_usd?: unknown }).honorarios_acordados_usd);
      if (Number.isFinite(h) && h > 0) {
        bonoPorEmpleado.set(eid, Math.round(h * 100) / 100);
      }
    }
  }

  const filas: FilaNominaContratado[] = [];
  const vistos = new Set<string>();

  for (const eid of empleadoIds) {
    const emp = empleadosMap.get(eid);
    if (!emp) continue;
    vistos.add(eid);
    filas.push({
      id: eid,
      nombres: emp.nombres || '—',
      apellidos: emp.apellidos || '—',
      cedula: emp.cedula,
      bonoUsd: bonoPorEmpleado.get(eid) ?? 0,
      fechaIngreso: fechaIngresoPorEmpleado.get(eid) ?? null,
    });
  }

  let expressQuery = supabase
    .from('ci_contratos_express')
    .select(
      'id,obrero_nombre,obrero_cedula,bono_manual_usd,created_at,formalizado_empleado_id,proyecto_id',
    )
    .is('formalizado_empleado_id', null)
    .order('created_at', { ascending: false });

  if (projectIds?.length) {
    expressQuery = expressQuery.in('proyecto_id', projectIds);
  }

  const { data: expressRows } = await expressQuery;
  for (const raw of expressRows ?? []) {
    const exId = sTrim((raw as { id?: unknown }).id);
    const cedula = sTrim((raw as { obrero_cedula?: unknown }).obrero_cedula);
    const ck = cedulaNorm(cedula);
    const dupEmp = Array.from(empleadosMap.entries()).find(([, e]) => e.cedulaNorm && e.cedulaNorm === ck);
    if (dupEmp && vistos.has(dupEmp[0])) continue;

    const nom = sTrim((raw as { obrero_nombre?: unknown }).obrero_nombre);
    const parts = nom.split(/\s+/).filter(Boolean);
    const nombres = parts.length >= 2 ? parts.slice(0, -1).join(' ') : parts[0] || '—';
    const apellidos = parts.length >= 2 ? (parts[parts.length - 1] ?? '—') : '—';
    const bono = Number((raw as { bono_manual_usd?: unknown }).bono_manual_usd);
    const created = sTrim((raw as { created_at?: unknown }).created_at);

    filas.push({
      id: exId ? `express-${exId}` : `express-${ck || nom}`,
      nombres,
      apellidos,
      cedula: cedula || '—',
      bonoUsd: Number.isFinite(bono) ? Math.max(0, Math.round(bono * 100) / 100) : 0,
      fechaIngreso: created ? created.slice(0, 10) : null,
    });
  }

  filas.sort((a, b) => {
    const ap = `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es', {
      sensitivity: 'base',
    });
    return ap;
  });

  return filas;
}
