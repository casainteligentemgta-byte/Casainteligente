/** Migraciones que crean cada bucket (supabase/migrations/). */
const BUCKET_MIGRATIONS: Record<string, string> = {
  'talento-public': '065_gaceta_postulacion_empleados_storage.sql',
  'talento-firmas': '067_firma_electronica_talento_firmas.sql',
  contratos_obreros: '074_storage_contratos_obreros.sql',
  'ci-talento-media': '040_ci_talento_storage_media.sql',
  'ci-proyectos-media': '038_ci_proyectos_storage_media.sql',
  'product-media': '012_products_manual_storage.sql',
  productos: '018_storage_bucket_productos.sql',
};

/**
 * Si Supabase devuelve que el bucket no existe, devuelve un mensaje accionable (aplicar migración o crear bucket en Dashboard).
 */
export function friendlyStorageError(bucket: string, raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('bucket') && lower.includes('not found')) {
    const mig = BUCKET_MIGRATIONS[bucket];
    if (mig) {
      return `El bucket Storage «${bucket}» no existe en este proyecto. Aplica la migración ${mig} (supabase db push / SQL Editor) o crea el bucket manualmente en Supabase → Storage.`;
    }
    return `El bucket Storage «${bucket}» no existe. Créalo en Supabase → Storage o aplica las migraciones del repositorio.`;
  }
  return raw;
}
