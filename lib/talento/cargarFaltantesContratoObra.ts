import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarPropsContratoObreroPdfExpress } from '@/lib/talento/contratoObreroPdfContext';
import { faltantesDesdePropsContrato, type FaltanteContrato } from '@/lib/talento/faltantesContratoObra';

/**
 * Datos de la obra y de la entidad empleadora que faltan para el contrato de esa obra.
 * Si no se pudo revisar (obra sin entidad, tabulador vacío…), devuelve el motivo en `error`.
 */
export async function cargarFaltantesContratoObra(
  db: SupabaseClient,
  proyectoId: string,
): Promise<{ faltantes: FaltanteContrato[]; error: string | null }> {
  const pid = proyectoId.trim();
  if (!pid) return { faltantes: [], error: 'Falta la obra.' };

  const { data: nom, error: eNom } = await db.from('ci_config_nomina').select('id').limit(1).maybeSingle();
  const nominaId = String((nom as { id?: string } | null)?.id ?? '').trim();
  if (eNom || !nominaId) {
    return { faltantes: [], error: 'No se pudo revisar: el tabulador de oficios está vacío.' };
  }

  const loaded = await cargarPropsContratoObreroPdfExpress(db, pid, nominaId, {
    obreroNombre: 'Revisión',
    obreroCedula: 'V-00000000',
  });
  if (!loaded.ok) return { faltantes: [], error: loaded.error };
  return { faltantes: faltantesDesdePropsContrato(loaded.props), error: null };
}
