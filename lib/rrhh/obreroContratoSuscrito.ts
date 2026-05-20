import type { SupabaseClient } from '@supabase/supabase-js';
import { normCedulaToken } from '@/lib/talento/cedulaAuth';

/** Estados de contrato obra en los que el obrero ya «suscribió» (aceptó/firmó). */
const ESTADOS_CONTRATO_OBRA_SUSCRITO = [
  'aceptado_digital',
  'firmado_y_archivado',
  'firmado_electronico',
  'firmado_activo',
] as const;

function cedulaNorm(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  try {
    return normCedulaToken(raw);
  } catch {
    return raw.replace(/\s/g, '').toLowerCase();
  }
}

/**
 * Obreros que ya tienen contrato suscrito (obra o express firmado/formalizado).
 * El bono en `project_assignments` solo debe editarse si el id NO está en este set.
 */
export async function idsObrerosConContratoSuscrito(
  supabase: SupabaseClient,
  workerIds: string[],
): Promise<Set<string>> {
  const locked = new Set<string>();
  const ids = Array.from(new Set(workerIds.map((s) => s.trim()).filter(Boolean)));
  if (ids.length === 0) return locked;

  const { data: obraRows } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('empleado_id,estado_contrato')
    .in('empleado_id', ids)
    .in('estado_contrato', [...ESTADOS_CONTRATO_OBRA_SUSCRITO]);

  for (const r of obraRows ?? []) {
    const eid = String((r as { empleado_id?: unknown }).empleado_id ?? '').trim();
    if (eid) locked.add(eid);
  }

  const { data: emps } = await supabase
    .from('ci_empleados')
    .select('id,cedula,documento')
    .in('id', ids);

  const cedulaPorWorker = new Map<string, string>();
  for (const e of emps ?? []) {
    const id = String((e as { id?: unknown }).id ?? '').trim();
    const ck = cedulaNorm(
      String((e as { cedula?: unknown }).cedula ?? (e as { documento?: unknown }).documento ?? ''),
    );
    if (id && ck) cedulaPorWorker.set(id, ck);
  }

  const { data: exByEmp } = await supabase
    .from('ci_contratos_express')
    .select('formalizado_empleado_id,pdf_firmado_storage_path')
    .in('formalizado_empleado_id', ids);

  for (const r of exByEmp ?? []) {
    const fid = String((r as { formalizado_empleado_id?: unknown }).formalizado_empleado_id ?? '').trim();
    if (fid) locked.add(fid);
  }

  const cedulas = Array.from(new Set(cedulaPorWorker.values())).filter(Boolean);
  if (cedulas.length > 0) {
    const { data: exRows } = await supabase
      .from('ci_contratos_express')
      .select('obrero_cedula,pdf_firmado_storage_path,formalizado_empleado_id');

    for (const raw of exRows ?? []) {
      const row = raw as {
        obrero_cedula?: string | null;
        pdf_firmado_storage_path?: string | null;
        formalizado_empleado_id?: string | null;
      };
      const firmado = Boolean((row.pdf_firmado_storage_path ?? '').trim());
      const formalizado = Boolean((row.formalizado_empleado_id ?? '').trim());
      if (!firmado && !formalizado) continue;
      const ck = cedulaNorm(row.obrero_cedula);
      if (!ck) continue;
      for (const [wid, wck] of Array.from(cedulaPorWorker.entries())) {
        if (wck === ck) locked.add(wid);
      }
    }
  }

  return locked;
}

/** Bono USD de la asignación activa más reciente del obrero (opcionalmente en proyectos del alcance). */
export async function bonoUsdDesdeAsignacionObrero(
  supabase: SupabaseClient,
  workerId: string,
  projectIds?: string[],
): Promise<number> {
  let q = supabase
    .from('project_assignments')
    .select('bono_usd,created_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (projectIds?.length) q = q.in('project_id', projectIds);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return 0;
  const b = (data as { bono_usd?: unknown }).bono_usd;
  if (typeof b === 'number' && Number.isFinite(b)) return Math.max(0, Math.round(b * 100) / 100);
  return 0;
}
