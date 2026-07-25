import type { SupabaseClient } from '@supabase/supabase-js';
import type { MinutaPheme } from '@/lib/pheme/types';

export type PersistirReunionPhemeInput = {
  titulo: string;
  transcripcion: string;
  minuta: MinutaPheme;
  markdown: string;
  modelo: string | null;
  desdeGemini: boolean;
  duracionMinutos?: number | null;
};

/**
 * Guarda en `reuniones_pheme` (prototipo / migración 292) y enriquece `ci_pheme_reuniones` (291).
 */
export async function persistirReunionPheme(
  supabase: SupabaseClient,
  input: PersistirReunionPhemeInput,
): Promise<{ id: string | null; idReunion: number | null; aviso?: string }> {
  const minutaJson = {
    resumen_ejecutivo: input.minuta.resumen_ejecutivo,
    puntos_clave: input.minuta.puntos_clave,
    acuerdos: input.minuta.acuerdos,
    pendientes_o_alertas: input.minuta.pendientes_o_alertas,
  };

  const { data: proto, error: errProto } = await supabase
    .from('reuniones_pheme')
    .insert({
      titulo_reunion: input.titulo,
      duracion_minutos: input.duracionMinutos ?? null,
      transcripcion_raw: input.transcripcion,
      resumen_ejecutivo: input.minuta.resumen_ejecutivo,
      minuta_json: minutaJson,
    } as never)
    .select('id_reunion')
    .single();

  if (errProto) {
    const msg = errProto.message ?? '';
    console.warn('[pheme persistir reuniones_pheme]', msg);
    const tip =
      msg.includes('reuniones_pheme') || msg.includes('schema cache') || msg.includes('PGRST')
        ? 'Ejecuta la migración 292_reuniones_pheme.sql en Supabase y recarga el schema.'
        : msg;

    // Fallback a tabla CI (291) si el prototipo aún no existe.
    const fallback = await persistirSoloCi(supabase, input, null);
    return {
      id: fallback.id,
      idReunion: null,
      aviso: `Minuta generada; reuniones_pheme no disponible (${tip}). ${fallback.aviso ?? ''}`.trim(),
    };
  }

  const idReunion = Number((proto as { id_reunion?: number } | null)?.id_reunion);
  const idReunionOk = Number.isFinite(idReunion) ? idReunion : null;

  const ci = await persistirSoloCi(supabase, input, idReunionOk);
  return {
    id: ci.id,
    idReunion: idReunionOk,
    aviso: ci.aviso,
  };
}

async function persistirSoloCi(
  supabase: SupabaseClient,
  input: PersistirReunionPhemeInput,
  idReunionPrototipo: number | null,
): Promise<{ id: string | null; aviso?: string }> {
  const minutaJson = {
    resumen_ejecutivo: input.minuta.resumen_ejecutivo,
    puntos_clave: input.minuta.puntos_clave,
    acuerdos: input.minuta.acuerdos,
    pendientes_o_alertas: input.minuta.pendientes_o_alertas,
  };

  const row: Record<string, unknown> = {
    titulo: input.titulo,
    transcripcion: input.transcripcion,
    resumen_ejecutivo: input.minuta.resumen_ejecutivo,
    puntos_clave: input.minuta.puntos_clave,
    acuerdos: input.minuta.acuerdos,
    pendientes_o_alertas: input.minuta.pendientes_o_alertas,
    markdown: input.markdown,
    modelo: input.modelo,
    desde_gemini: input.desdeGemini,
    duracion_minutos: input.duracionMinutos ?? null,
    minuta_json: minutaJson,
  };
  if (idReunionPrototipo != null) {
    row.id_reunion_prototipo = idReunionPrototipo;
  }

  const { data, error } = await supabase
    .from('ci_pheme_reuniones')
    .insert(row as never)
    .select('id')
    .single();

  if (error) {
    const msg = error.message ?? '';
    console.warn('[pheme persistir ci_pheme_reuniones]', msg);
    if (msg.includes('ci_pheme_reuniones') || msg.includes('schema cache')) {
      return {
        id: null,
        aviso: 'Tabla ci_pheme_reuniones ausente (migración 291).',
      };
    }
    return { id: null, aviso: `No se pudo guardar en CI: ${msg}` };
  }

  return { id: (data as { id?: string } | null)?.id ?? null };
}
