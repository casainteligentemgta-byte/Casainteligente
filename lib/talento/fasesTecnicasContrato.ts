/**
 * Catálogo de fases técnicas (cláusula PRIMERA) reutilizables entre obras/contratos.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type FaseTecnicaCatalogo = {
  id: string;
  texto: string;
  usos_count: number;
  ultimo_uso_at: string;
};

/** Normaliza para deduplicar (minúsculas, sin diacríticos, espacios colapsados). */
export function claveNormFaseTecnica(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function trimFaseTecnica(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ');
  return t.length >= 2 ? t : null;
}

/**
 * Graba/reusa una fase técnica en el catálogo y, si hay proyecto, actualiza su default.
 * Idempotente: misma clave_norm incrementa usos_count y refresca texto/último uso.
 */
export async function recordarFaseTecnicaUsada(
  admin: SupabaseClient,
  textoRaw: string | null | undefined,
  opts?: { proyectoId?: string | null },
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const texto = trimFaseTecnica(textoRaw);
  if (!texto) return { ok: false, error: 'Fase técnica vacía' };

  const clave = claveNormFaseTecnica(texto);
  const now = new Date().toISOString();

  const { data: existing, error: selErr } = await admin
    .from('ci_fases_tecnicas_contrato')
    .select('id,usos_count')
    .eq('clave_norm', clave)
    .maybeSingle();

  if (selErr && !/relation|does not exist|42P01|schema cache/i.test(selErr.message)) {
    return { ok: false, error: selErr.message };
  }

  if (existing && (existing as { id?: string }).id) {
    const row = existing as { id: string; usos_count?: number | null };
    const usos = Math.max(0, Number(row.usos_count) || 0) + 1;
    const { error: updErr } = await admin
      .from('ci_fases_tecnicas_contrato')
      .update({
        texto,
        usos_count: usos,
        ultimo_uso_at: now,
        updated_at: now,
      } as never)
      .eq('id', row.id);
    if (updErr && !/relation|does not exist|42P01|schema cache/i.test(updErr.message)) {
      return { ok: false, error: updErr.message };
    }
  } else if (!selErr) {
    const { error: insErr } = await admin.from('ci_fases_tecnicas_contrato').insert({
      texto,
      clave_norm: clave,
      usos_count: 1,
      ultimo_uso_at: now,
      updated_at: now,
    } as never);
    if (insErr && !/relation|does not exist|42P01|schema cache|duplicate|23505/i.test(insErr.message)) {
      return { ok: false, error: insErr.message };
    }
  }

  const proyectoId = (opts?.proyectoId ?? '').trim();
  if (proyectoId) {
    const { error: proyErr } = await admin
      .from('ci_proyectos')
      .update({
        fase_tecnica_contrato_default: texto,
        updated_at: now,
      } as never)
      .eq('id', proyectoId);
    // Columna nueva: no fallar el contrato si aún no está migrada.
    if (proyErr && !/column|42703|schema cache|does not exist/i.test(proyErr.message)) {
      return { ok: false, error: proyErr.message };
    }
  }

  return { ok: true, texto };
}

/** Lista fases del catálogo (más usadas / recientes primero). */
export async function listarFasesTecnicasContrato(
  client: SupabaseClient,
  limit = 40,
): Promise<FaseTecnicaCatalogo[]> {
  const lim = Math.min(100, Math.max(1, limit));
  const { data, error } = await client
    .from('ci_fases_tecnicas_contrato')
    .select('id,texto,usos_count,ultimo_uso_at')
    .order('usos_count', { ascending: false })
    .order('ultimo_uso_at', { ascending: false })
    .limit(lim);

  if (error) {
    if (/relation|does not exist|42P01|schema cache/i.test(error.message)) return [];
    return [];
  }

  return ((data ?? []) as FaseTecnicaCatalogo[]).filter((r) => (r.texto ?? '').trim().length >= 2);
}

/** Default de fase técnica de la obra (si existe la columna). */
export async function faseTecnicaDefaultProyecto(
  client: SupabaseClient,
  proyectoId: string,
): Promise<string | null> {
  const id = proyectoId.trim();
  if (!id) return null;
  const { data, error } = await client
    .from('ci_proyectos')
    .select('fase_tecnica_contrato_default')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return trimFaseTecnica(
    (data as { fase_tecnica_contrato_default?: string | null } | null)?.fase_tecnica_contrato_default,
  );
}
