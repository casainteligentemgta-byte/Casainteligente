import type { SupabaseClient } from '@supabase/supabase-js';
import { planillaPatronoDesdeEntidadRow } from '@/lib/talento/planillaPatronoBuild';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';

function trimStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

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

/** `proyecto_modulo_id` del empleado o, si falta, el de la vacante (`recruitment_needs`). */
export async function resolveProyectoModuloIdDesdeEmpleado(
  client: SupabaseClient,
  row: Record<string, unknown>,
): Promise<string | null> {
  const direct = trimStr(row.proyecto_modulo_id);
  if (direct) return direct;
  const needId = trimStr(row.recruitment_need_id);
  if (!needId) return null;
  const { data: need, error } = await client
    .from('recruitment_needs')
    .select('proyecto_modulo_id, proyecto_id')
    .eq('id', needId)
    .maybeSingle();
  if (error || !need) return null;
  const n = need as { proyecto_modulo_id?: string | null; proyecto_id?: string | null };
  return trimStr(n.proyecto_modulo_id) || trimStr(n.proyecto_id) || null;
}

const PATRON_KEYS: (keyof PlanillaPatronoCampos)[] = [
  'entidadNombre',
  'entidadRif',
  'proyectoNombre',
  'representanteNombreApellido',
  'representanteCi',
  'representanteEdad',
  'representanteEstadoCivil',
  'representanteCargo',
  'representanteNacionalidad',
  'empresaDomicilio',
];

/** Superpone campos no vacíos guardados en `hoja_vida_obrero.planillaPatrono` (snapshot captación). */
export function mergePlanillaPatronoOverlayHoja(hojaRaw: unknown, base: PlanillaPatronoCampos): PlanillaPatronoCampos {
  if (!hojaRaw || typeof hojaRaw !== 'object' || Array.isArray(hojaRaw)) return base;
  const pp = (hojaRaw as Record<string, unknown>).planillaPatrono;
  if (!pp || typeof pp !== 'object' || Array.isArray(pp)) return base;
  const o = pp as Record<string, unknown>;
  const out: PlanillaPatronoCampos = { ...base };
  for (const k of PATRON_KEYS) {
    const v = o[k as string];
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (t) (out as Record<string, string | undefined>)[k] = t;
  }
  return out;
}

/** Rellena vacíos con variables públicas de marca (misma idea que contrato PDF). */
export function mergePlanillaPatronoFallbackPublico(campos: PlanillaPatronoCampos): PlanillaPatronoCampos {
  const envNombre = trimStr(process.env.NEXT_PUBLIC_PATRON_NOMBRE ?? 'CASA INTELIGENTE');
  const envDom = trimStr(process.env.NEXT_PUBLIC_PATRON_DOMICILIO ?? '');
  const envRep = trimStr(process.env.NEXT_PUBLIC_PATRON_REPRESENTANTE ?? '');
  const out: PlanillaPatronoCampos = { ...campos };
  if (!trimStr(out.entidadNombre)) out.entidadNombre = envNombre;
  if (!trimStr(out.empresaDomicilio) && envDom) out.empresaDomicilio = envDom;
  if (!trimStr(out.representanteNombreApellido) && envRep) out.representanteNombreApellido = envRep;
  return out;
}

export type ResolvePlanillaPatronoParaEmpleadoOpts = {
  /** Si el empleado no tiene `proyecto_modulo_id` pero el contexto conoce el proyecto (p. ej. contrato → obra). */
  proyectoModuloIdAlternativo?: string | null;
};

/**
 * Patrono completo para hoja de empleo / vista: proyecto vía empleado o vacante, overlay JSON hoja,
 * y fallbacks `NEXT_PUBLIC_PATRON_*` para que nunca quede la sección I en blanco si hay env configurado.
 */
export async function resolvePlanillaPatronoParaEmpleado(
  client: SupabaseClient,
  row: Record<string, unknown>,
  opts?: ResolvePlanillaPatronoParaEmpleadoOpts,
): Promise<PlanillaPatronoCampos> {
  let pid = await resolveProyectoModuloIdDesdeEmpleado(client, row);
  if (!pid && opts?.proyectoModuloIdAlternativo) {
    pid = trimStr(opts.proyectoModuloIdAlternativo);
  }
  let campos = await resolvePlanillaPatronoPdf(client, pid);
  campos = mergePlanillaPatronoOverlayHoja(row.hoja_vida_obrero, campos);
  campos = mergePlanillaPatronoFallbackPublico(campos);
  return campos;
}
