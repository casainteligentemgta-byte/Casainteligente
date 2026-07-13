import type { SupabaseClient } from '@supabase/supabase-js';

type PartidaMontos = {
  id?: string;
  precio_unitario_estimado?: number | null;
  monto_total_estimado?: number | null;
  cantidad_presupuestada?: number | null;
};

/** Persiste P.U. y monto cuando cambiaron respecto al estado anterior. */
export async function persistirMontosPartidasLulo(
  supabase: SupabaseClient,
  antes: PartidaMontos[],
  despues: PartidaMontos[],
): Promise<number> {
  const prevById = new Map(
    antes.filter((p) => p.id).map((p) => [
      p.id!,
      {
        precio: Number(p.precio_unitario_estimado ?? 0),
        monto: Number(p.monto_total_estimado ?? 0),
      },
    ]),
  );

  let guardadas = 0;
  for (const p of despues) {
    if (!p.id) continue;
    const prev = prevById.get(p.id);
    const precio = Number(p.precio_unitario_estimado ?? 0);
    const monto = Number(p.monto_total_estimado ?? 0);
    if (precio <= 0 && monto <= 0) continue;
    if (prev && prev.precio === precio && prev.monto === monto) continue;

    const { error } = await supabase
      .from('ci_presupuesto_partidas')
      .update({
        precio_unitario_estimado: precio,
        monto_total_estimado: monto,
        ...(Number(p.cantidad_presupuestada) > 0
          ? { cantidad_presupuestada: p.cantidad_presupuestada }
          : {}),
      })
      .eq('id', p.id);

    if (!error) guardadas += 1;
    else console.warn('[persistirMontosPartidasLulo]', p.id, error.message);
  }

  return guardadas;
}
