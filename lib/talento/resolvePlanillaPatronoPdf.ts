import type { SupabaseClient } from '@supabase/supabase-js';
import { planillaPatronoDesdeEntidadRow } from '@/lib/talento/planillaPatronoBuild';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';

/**
 * Rellena datos del patrono para la planilla de empleo (PDF / vista),
 * desde `ci_empleados.proyecto_modulo_id` → `ci_proyectos` → `ci_entidades`.
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
  const proyectoNombre = String(pr.nombre ?? '').trim();

  const eid = String(pr.entidad_id ?? '').trim();
  if (!eid) return { proyectoNombre };

  const { data: e, error: eErr } = await client
    .from('ci_entidades')
    .select(
      'nombre, nombre_legal, rif, domicilio_fiscal, direccion_fiscal, rep_legal_nombre, rep_legal_cedula, rep_legal_cargo, registro_mercantil',
    )
    .eq('id', eid)
    .maybeSingle();
  if (eErr || !e) return { proyectoNombre };

  const er = e as {
    nombre: string | null;
    nombre_legal?: string | null;
    rif: string | null;
    domicilio_fiscal?: string | null;
    direccion_fiscal?: string | null;
    rep_legal_nombre?: string | null;
    rep_legal_cedula?: string | null;
    rep_legal_cargo?: string | null;
    registro_mercantil?: unknown;
  };

  return planillaPatronoDesdeEntidadRow({
    nombre: er.nombre,
    nombre_legal: er.nombre_legal,
    rif: er.rif,
    domicilio_fiscal: er.domicilio_fiscal,
    direccion_fiscal: er.direccion_fiscal,
    rep_legal_nombre: er.rep_legal_nombre,
    rep_legal_cedula: er.rep_legal_cedula,
    rep_legal_cargo: er.rep_legal_cargo,
    registro_mercantil: er.registro_mercantil,
    proyectoNombre,
  });
}
