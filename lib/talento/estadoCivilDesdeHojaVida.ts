/**
 * Estado civil en contrato individual:
 * 1) hoja de vida (si está llenada),
 * 2) columna / valor del contrato,
 * 3) «Soltero» por defecto.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cedulaAuthCoincide,
  cedulaDigitosCore,
  estadoCivilContratoObrero,
  normCedulaToken,
} from '@/lib/talento/cedulaAuth';

function trimOpt(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

/** Extrae estado civil de `hoja_vida_obrero.datosPersonales` si está lleno. */
export function estadoCivilDesdeHojaVidaJson(hoja: unknown): string | null {
  if (!hoja || typeof hoja !== 'object' || Array.isArray(hoja)) return null;
  const dp = (hoja as { datosPersonales?: unknown }).datosPersonales;
  if (!dp || typeof dp !== 'object' || Array.isArray(dp)) return null;
  return trimOpt((dp as { estadoCivil?: unknown }).estadoCivil);
}

export type EstadoCivilDesdeExpediente = {
  desdeHoja: string | null;
  desdeColumna: string | null;
};

/**
 * Busca expediente por cédula y devuelve estado civil de hoja de vida (prioridad)
 * y de la columna `ci_empleados.estado_civil`.
 */
export async function buscarEstadoCivilExpedientePorCedula(
  client: SupabaseClient,
  cedulaRaw: string,
): Promise<EstadoCivilDesdeExpediente> {
  const empty: EstadoCivilDesdeExpediente = { desdeHoja: null, desdeColumna: null };
  const ced = normCedulaToken(cedulaRaw);
  const digitos = cedulaDigitosCore(ced);
  if (!digitos || digitos.length < 6) return empty;

  const variants = Array.from(
    new Set([
      ced,
      `V${digitos}`,
      `E${digitos}`,
      digitos,
      `V-${digitos}`,
      `E-${digitos}`,
    ]),
  );

  const orParts = variants.flatMap((v) => [`cedula.eq.${v}`, `documento.eq.${v}`]);
  const { data, error } = await client
    .from('ci_empleados')
    .select('cedula,documento,estado_civil,hoja_vida_obrero')
    .or(orParts.join(','))
    .limit(40);

  if (error || !data?.length) {
    // Respaldo: búsqueda amplia por núcleo numérico (formatos sueltos en BD).
    const { data: loose } = await client
      .from('ci_empleados')
      .select('cedula,documento,estado_civil,hoja_vida_obrero')
      .or(`cedula.ilike.%${digitos}%,documento.ilike.%${digitos}%`)
      .limit(40);
    return pickEstadoCivilDeCandidatos(loose ?? [], ced);
  }

  return pickEstadoCivilDeCandidatos(data, ced);
}

function pickEstadoCivilDeCandidatos(
  rows: unknown[],
  cedulaNorm: string,
): EstadoCivilDesdeExpediente {
  let desdeHoja: string | null = null;
  let desdeColumna: string | null = null;

  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as {
      cedula?: string | null;
      documento?: string | null;
      estado_civil?: string | null;
      hoja_vida_obrero?: unknown;
    };
    const dbDoc = String(row.cedula ?? row.documento ?? '').trim();
    if (!dbDoc || !cedulaAuthCoincide(dbDoc, cedulaNorm)) continue;

    const hoja = estadoCivilDesdeHojaVidaJson(row.hoja_vida_obrero);
    if (hoja && !desdeHoja) desdeHoja = hoja;
    const col = trimOpt(row.estado_civil);
    if (col && !desdeColumna) desdeColumna = col;
    if (desdeHoja) break;
  }

  return { desdeHoja, desdeColumna };
}

/**
 * Resuelve estado civil para contrato: hoja de vida → columna/manual → Soltero.
 */
export function resolverEstadoCivilContrato(opts: {
  desdeHoja?: string | null;
  desdeColumna?: string | null;
  manual?: string | null;
}): string {
  return estadoCivilContratoObrero(opts.desdeHoja, opts.desdeColumna, opts.manual);
}
