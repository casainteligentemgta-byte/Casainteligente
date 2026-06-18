import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';

/** Completa ingreso físico y ubicación desde recepciones de campo enlazadas a contabilidad. */
export async function enriquecerComprasRecepcionCampo(
  supabase: SupabaseClient,
  compras: CompraListaUnificada[],
): Promise<CompraListaUnificada[]> {
  const compraIds = Array.from(
    new Set(
      compras
        .filter(
          (c) =>
            (c.fuente_lista === 'app' || c.fuente_lista == null) &&
            !c.id.startsWith('canal-') &&
            (!c.ingresado_almacen_at?.trim() || !c.ubicacion_destino_id?.trim()),
        )
        .map((c) => c.id.trim())
        .filter(Boolean),
    ),
  ).slice(0, 400);

  if (!compraIds.length) return compras;

  const { data, error } = await supabase
    .from('ci_recepciones_campo')
    .select('contabilidad_compra_id, ubicacion_id, created_at, estado')
    .in('contabilidad_compra_id', compraIds)
    .eq('estado', 'registrado');

  if (error?.code === '42P01' || error) return compras;

  const porCompra = new Map<string, { ubicacion_id: string; ingresado_at: string }>();

  for (const row of data ?? []) {
    const cid = String(
      (row as { contabilidad_compra_id?: string | null }).contabilidad_compra_id ?? '',
    ).trim();
    if (!cid || porCompra.has(cid)) continue;
    const ubicacionId = String((row as { ubicacion_id?: string | null }).ubicacion_id ?? '').trim();
    const ingresadoAt =
      String((row as { created_at?: string | null }).created_at ?? '').trim() ||
      new Date().toISOString();
    porCompra.set(cid, { ubicacion_id: ubicacionId, ingresado_at: ingresadoAt });
  }

  if (!porCompra.size) return compras;

  return compras.map((c) => {
    const rec = porCompra.get(c.id);
    if (!rec) return c;
    return {
      ...c,
      ubicacion_destino_id: c.ubicacion_destino_id?.trim() || rec.ubicacion_id || null,
      ingresado_almacen_at: c.ingresado_almacen_at?.trim() || rec.ingresado_at,
    };
  });
}
