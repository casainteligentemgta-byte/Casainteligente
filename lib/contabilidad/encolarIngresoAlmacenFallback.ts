import type { SupabaseClient } from '@supabase/supabase-js';

type ExtractedConCola = Record<string, unknown> & {
  _ingreso_almacen_pendiente?: {
    error: string;
    encolado_at: string;
    intentos?: number;
  };
};

/**
 * Marca en `extracted` (JSON existente) un ingreso a almacén pendiente tras fallo de red/API.
 * No requiere tabla nueva; operaciones puede reintentar desde la UI.
 */
export async function encolarIngresoAlmacenFallback(
  supabase: SupabaseClient,
  pendingId: string,
  error: string,
): Promise<void> {
  const id = pendingId.trim();
  if (!id) return;

  const { data: row } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', id)
    .maybeSingle();

  const prev = (row?.extracted ?? {}) as ExtractedConCola;
  const intentos = (prev._ingreso_almacen_pendiente?.intentos ?? 0) + 1;

  const extracted: ExtractedConCola = {
    ...prev,
    _ingreso_almacen_pendiente: {
      error: error.slice(0, 500),
      encolado_at: new Date().toISOString(),
      intentos,
    },
  };

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id);
}
