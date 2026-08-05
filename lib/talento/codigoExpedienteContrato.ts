/**
 * Código de expediente de contrato laboral (formato sencillo):
 * `YYYY-MM-{ENTIDAD}-{OBRA}-{NN}`
 *
 * - ENTIDAD: `ci_entidades.nombre_abreviado` o siglas del nombre
 * - OBRA: `ci_proyectos.obra_codigo` o slug del nombre
 * - NN: correlativo del mes en esa obra
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export function slugParteCodigoContrato(raw: string | null | undefined, maxLen = 16): string {
  const t = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .trim();
  if (!t) return '';
  return t.slice(0, Math.max(1, maxLen));
}

/** Siglas o abreviatura de entidad (prioridad: nombre_abreviado). */
export function nomenclaturaEntidadContrato(
  nombreAbreviado: string | null | undefined,
  nombre: string | null | undefined,
): string {
  const ab = slugParteCodigoContrato(nombreAbreviado, 12);
  if (ab) return ab;
  const nom = String(nombre ?? '').trim();
  if (!nom) return 'ENT';
  const words = nom.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .map((w) => w[0] ?? '')
      .join('')
      .replace(/[^A-Za-z0-9]/g, '');
    const s = slugParteCodigoContrato(initials, 8);
    if (s) return s;
  }
  return slugParteCodigoContrato(nom, 8) || 'ENT';
}

export function nomenclaturaObraContrato(
  obraCodigo: string | null | undefined,
  obraNombre: string | null | undefined,
): string {
  const cod = slugParteCodigoContrato(obraCodigo, 20);
  if (cod) return cod;
  return slugParteCodigoContrato(obraNombre, 16) || 'OBRA';
}

export function partesFechaCodigoContrato(fecha?: Date | string | null): { yyyy: string; mm: string } {
  const d =
    fecha instanceof Date
      ? fecha
      : typeof fecha === 'string' && fecha.trim()
        ? new Date(fecha)
        : new Date();
  const safe = Number.isFinite(d.getTime()) ? d : new Date();
  const yyyy = String(safe.getFullYear());
  const mm = String(safe.getMonth() + 1).padStart(2, '0');
  return { yyyy, mm };
}

export function construirCodigoExpedienteContrato(opts: {
  fecha?: Date | string | null;
  entidadAbreviado?: string | null;
  entidadNombre?: string | null;
  obraCodigo?: string | null;
  obraNombre?: string | null;
  correlativo?: number | null;
}): string {
  const { yyyy, mm } = partesFechaCodigoContrato(opts.fecha);
  const ent = nomenclaturaEntidadContrato(opts.entidadAbreviado, opts.entidadNombre);
  const obra = nomenclaturaObraContrato(opts.obraCodigo, opts.obraNombre);
  const n =
    opts.correlativo != null && Number.isFinite(Number(opts.correlativo)) && Number(opts.correlativo) > 0
      ? Math.floor(Number(opts.correlativo))
      : null;
  const suf = n != null ? `-${String(n).padStart(2, '0')}` : '';
  return `${yyyy}-${mm}-${ent}-${obra}${suf}`;
}

/**
 * Resuelve entidad/obra desde el proyecto y arma el código con correlativo del mes.
 */
export async function resolverCodigoExpedienteContrato(
  supabase: SupabaseClient,
  opts: {
    proyectoId: string;
    entidadPatronoId?: string | null;
    fecha?: Date | string | null;
    /** Si se regenera un contrato existente, mantiene correlativo estable por orden de creación. */
    expressId?: string | null;
  },
): Promise<string> {
  const pid = opts.proyectoId.trim();
  const { yyyy, mm } = partesFechaCodigoContrato(opts.fecha);
  const mesInicio = `${yyyy}-${mm}-01T00:00:00.000Z`;
  const mesSiguienteNum = Number(mm) === 12 ? 1 : Number(mm) + 1;
  const anioSiguiente = Number(mm) === 12 ? Number(yyyy) + 1 : Number(yyyy);
  const mesFin = `${anioSiguiente}-${String(mesSiguienteNum).padStart(2, '0')}-01T00:00:00.000Z`;

  const { data: pr } = await supabase
    .from('ci_proyectos')
    .select('id,nombre,obra_codigo,entidad_id')
    .eq('id', pid)
    .maybeSingle();

  const proyecto = (pr ?? null) as {
    id?: string;
    nombre?: string | null;
    obra_codigo?: string | null;
    entidad_id?: string | null;
  } | null;

  const entidadId = String(opts.entidadPatronoId ?? proyecto?.entidad_id ?? '').trim() || null;
  let entidadAbreviado: string | null = null;
  let entidadNombre: string | null = null;
  if (entidadId) {
    const { data: ent } = await supabase
      .from('ci_entidades')
      .select('nombre,nombre_abreviado')
      .eq('id', entidadId)
      .maybeSingle();
    const e = (ent ?? null) as { nombre?: string | null; nombre_abreviado?: string | null } | null;
    entidadAbreviado = e?.nombre_abreviado ?? null;
    entidadNombre = e?.nombre ?? null;
  }

  let correlativo = 1;
  const eid = String(opts.expressId ?? '').trim();
  if (eid) {
    const { data: rows } = await supabase
      .from('ci_contratos_express')
      .select('id,created_at')
      .eq('proyecto_id', pid)
      .gte('created_at', mesInicio)
      .lt('created_at', mesFin)
      .order('created_at', { ascending: true });
    const list = Array.isArray(rows) ? rows : [];
    const idx = list.findIndex((r) => String((r as { id?: string }).id ?? '') === eid);
    correlativo = idx >= 0 ? idx + 1 : list.length + 1;
  } else {
    const { count } = await supabase
      .from('ci_contratos_express')
      .select('id', { count: 'exact', head: true })
      .eq('proyecto_id', pid)
      .gte('created_at', mesInicio)
      .lt('created_at', mesFin);
    correlativo = (typeof count === 'number' && count >= 0 ? count : 0) + 1;
  }

  return construirCodigoExpedienteContrato({
    fecha: opts.fecha,
    entidadAbreviado,
    entidadNombre,
    obraCodigo: proyecto?.obra_codigo,
    obraNombre: proyecto?.nombre,
    correlativo,
  });
}
