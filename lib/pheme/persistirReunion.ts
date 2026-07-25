import type { SupabaseClient } from '@supabase/supabase-js';
import type { MinutaPheme } from '@/lib/pheme/types';

export type PersistirReunionPhemeInput = {
  titulo: string;
  transcripcion: string;
  minuta: MinutaPheme;
  markdown: string;
  modelo: string | null;
  desdeGemini: boolean;
};

/**
 * Guarda la minuta en `ci_pheme_reuniones` (migración 291).
 * Si la tabla no existe aún, no falla el flujo: retorna null + aviso.
 */
export async function persistirReunionPheme(
  supabase: SupabaseClient,
  input: PersistirReunionPhemeInput,
): Promise<{ id: string | null; aviso?: string }> {
  const { data, error } = await supabase
    .from('ci_pheme_reuniones')
    .insert({
      titulo: input.titulo,
      transcripcion: input.transcripcion,
      resumen_ejecutivo: input.minuta.resumen_ejecutivo,
      puntos_clave: input.minuta.puntos_clave,
      acuerdos: input.minuta.acuerdos,
      pendientes_o_alertas: input.minuta.pendientes_o_alertas,
      markdown: input.markdown,
      modelo: input.modelo,
      desde_gemini: input.desdeGemini,
    } as never)
    .select('id')
    .single();

  if (error) {
    const msg = error.message ?? '';
    console.warn('[pheme persistir]', msg);
    const tip =
      msg.includes('ci_pheme_reuniones') || msg.includes('schema cache') || msg.includes('PGRST')
        ? 'Ejecuta la migración 291_ci_pheme_reuniones.sql en Supabase y recarga el schema.'
        : msg;
    return { id: null, aviso: `Minuta generada pero no guardada: ${tip}` };
  }

  const id = (data as { id?: string } | null)?.id ?? null;
  return { id };
}
