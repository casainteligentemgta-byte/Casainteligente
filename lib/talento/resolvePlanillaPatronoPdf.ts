import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';

/**
 * Rellena entidad / RIF / proyecto para la franja superior de la planilla (PDF),
 * a partir de `ci_empleados.proyecto_modulo_id` → `ci_proyectos` → `ci_entidades`.
 */
export async function resolvePlanillaPatronoPdf(
  client: SupabaseClient,
  proyectoModuloId: string | null | undefined,
): Promise<PlanillaPatronoCampos> {
  const pid = String(proyectoModuloId ?? '').trim();
  if (!pid) return {};

  const { data: p, error: pErr } = await client.from('ci_proyectos').select('nombre, entidad_id').eq('id', pid).maybeSingle();
  if (pErr || !p) return {};

  const pr = p as { nombre: string | null; entidad_id: string | null };
  const out: PlanillaPatronoCampos = {
    proyectoNombre: String(pr.nombre ?? '').trim(),
  };

  const eid = String(pr.entidad_id ?? '').trim();
  if (!eid) return out;

  const { data: e, error: eErr } = await client.from('ci_entidades').select('nombre, rif').eq('id', eid).maybeSingle();
  if (eErr || !e) return out;

  const er = e as { nombre: string | null; rif: string | null };
  out.entidadNombre = String(er.nombre ?? '').trim();
  out.entidadRif = String(er.rif ?? '').trim();
  return out;
}
