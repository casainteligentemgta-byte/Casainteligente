import type { SupabaseClient } from '@supabase/supabase-js';
import { parseMontoBimonetario } from '@/lib/contabilidad/validarCompraBimonetaria';

export type TasaBcvConfigNomina = {
  tasa_bcv_ves_por_usd: number;
  vigencia_desde: string | null;
  fuente: 'ci_config_nomina';
};

const CARGO_CONFIG_GLOBAL = 'GLOBAL';

/**
 * Última tasa BCV de la fila de configuración global en ci_config_nomina.
 * Requiere migración 156 (columna tasa_bcv_ves_por_usd).
 */
export async function obtenerTasaBcvConfigNominaGlobal(
  supabase: SupabaseClient,
): Promise<TasaBcvConfigNomina | null> {
  const { data, error } = await supabase
    .from('ci_config_nomina')
    .select('tasa_bcv_ves_por_usd, tasa_bcv_vigencia_desde, updated_at')
    .eq('cargo_codigo', CARGO_CONFIG_GLOBAL)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const missingColumn =
      /tasa_bcv|column.*does not exist|schema cache/i.test(error.message);
    if (missingColumn) {
      throw new Error(
        'Falta la columna tasa_bcv_ves_por_usd en ci_config_nomina. Ejecuta la migración 156 en Supabase.',
      );
    }
    throw new Error(`No se pudo leer ci_config_nomina: ${error.message}`);
  }

  const tasa = parseMontoBimonetario(data?.tasa_bcv_ves_por_usd);
  if (tasa == null || tasa <= 0) return null;

  const vigencia =
    data?.tasa_bcv_vigencia_desde != null
      ? String(data.tasa_bcv_vigencia_desde).slice(0, 10)
      : null;

  return {
    tasa_bcv_ves_por_usd: tasa,
    vigencia_desde: vigencia,
    fuente: 'ci_config_nomina',
  };
}
