/**
 * Un candidato que llenó el enlace de una obra NO es trabajador de esa obra.
 * Solo cuenta contrato o asignación laboral.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normCedulaToken } from '@/lib/talento/cedulaAuth';
import { esContratoExpressAdministracionDelegada } from '@/lib/talento/filtrarContratosExpressObrero';

export type VinculosContratacion = Map<string, Set<string>>;

export function agregarVinculoContrato(
  map: VinculosContratacion,
  empleadoId: string | null | undefined,
  proyectoId: string | null | undefined,
): void {
  const wid = String(empleadoId ?? '').trim();
  const pid = String(proyectoId ?? '').trim();
  if (!wid || !pid) return;
  let set = map.get(wid);
  if (!set) {
    set = new Set();
    map.set(wid, set);
  }
  set.add(pid);
}

export function empleadoEstaContratado(vinculos: VinculosContratacion, empleadoId: string): boolean {
  return (vinculos.get(empleadoId.trim())?.size ?? 0) > 0;
}

function s(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function cedulaKey(raw: unknown): string {
  const t = s(raw);
  return t ? normCedulaToken(t) : '';
}

/**
 * Carga vínculos reales de contratación (no HV / no vacante).
 */
export async function cargarVinculosContratacionProyecto(
  supabase: SupabaseClient,
): Promise<VinculosContratacion> {
  const vinculos: VinculosContratacion = new Map();

  const empLite = await supabase
    .from('ci_empleados')
    .select('id,cedula,documento')
    .limit(2500);
  const idPorCedula = new Map<string, string>();
  if (!empLite.error && empLite.data) {
    for (const raw of empLite.data as { id?: string; cedula?: string; documento?: string }[]) {
      const id = s(raw.id);
      const ck = cedulaKey(raw.cedula) || cedulaKey(raw.documento);
      if (id && ck) idPorCedula.set(ck, id);
    }
  }

  type ExpressRow = {
    proyecto_id?: string;
    obrero_cedula?: string | null;
    obrero_nombre?: string | null;
    formalizado_empleado_id?: string | null;
    tipo_contrato?: string | null;
  };
  const exFull = await supabase
    .from('ci_contratos_express')
    .select('proyecto_id,obrero_cedula,obrero_nombre,formalizado_empleado_id,tipo_contrato')
    .limit(4000);
  let exRows: ExpressRow[] | null = !exFull.error ? (exFull.data as ExpressRow[]) : null;
  if (exFull.error && /formalizado_empleado_id|tipo_contrato|42703|schema cache|column/i.test(exFull.error.message ?? '')) {
    const lite = await supabase
      .from('ci_contratos_express')
      .select('proyecto_id,obrero_cedula,obrero_nombre')
      .limit(4000);
    exRows = !lite.error ? (lite.data as ExpressRow[]) : null;
  }
  for (const raw of exRows ?? []) {
    if (esContratoExpressAdministracionDelegada(raw)) continue;
    const pid = s(raw.proyecto_id);
    const fid = s(raw.formalizado_empleado_id);
    if (fid) agregarVinculoContrato(vinculos, fid, pid);
    const eid = idPorCedula.get(cedulaKey(raw.obrero_cedula));
    if (eid) agregarVinculoContrato(vinculos, eid, pid);
  }

  type ObraRow = { empleado_id?: string; obra_id?: string; proyecto_id?: string };
  const obraFull = await supabase
    .from('ci_contratos_empleado_obra')
    .select('empleado_id,obra_id,proyecto_id')
    .limit(4000);
  let obraRows: ObraRow[] | null = !obraFull.error ? (obraFull.data as ObraRow[]) : null;
  if (obraFull.error && /obra_id|42703|schema cache|column/i.test(obraFull.error.message ?? '')) {
    const obraLite = await supabase.from('ci_contratos_empleado_obra').select('empleado_id,proyecto_id').limit(4000);
    obraRows = !obraLite.error ? (obraLite.data as ObraRow[]) : null;
  }
  if (obraRows) {
    for (const raw of obraRows) {
      agregarVinculoContrato(vinculos, raw.empleado_id, raw.obra_id);
      agregarVinculoContrato(vinculos, raw.empleado_id, raw.proyecto_id);
    }
  }

  const asg = await supabase.from('project_assignments').select('worker_id,project_id').limit(8000);
  if (!asg.error && asg.data) {
    for (const raw of asg.data as { worker_id?: string; project_id?: string }[]) {
      agregarVinculoContrato(vinculos, raw.worker_id, raw.project_id);
    }
  }

  const oe = await supabase.from('ci_obra_empleados').select('empleado_id,obra_id').limit(8000);
  if (!oe.error && oe.data) {
    for (const raw of oe.data as { empleado_id?: string; obra_id?: string }[]) {
      agregarVinculoContrato(vinculos, raw.empleado_id, raw.obra_id);
    }
  }

  return vinculos;
}
