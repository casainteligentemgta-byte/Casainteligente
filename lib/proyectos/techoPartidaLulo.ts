import type { SupabaseClient } from '@supabase/supabase-js';

/** Monto presupuestado de la partida menos ventas de maquinaria ya registradas. */
export async function calcularTechoRemanentePartida(
  supabase: SupabaseClient,
  partidaId: string,
): Promise<{ techo: number; consumido: number; remanente: number }> {
  const { data: partida, error: pErr } = await supabase
    .from('ci_presupuesto_partidas')
    .select('monto_total_estimado')
    .eq('id', partidaId)
    .maybeSingle();

  if (pErr?.code === '42P01') return { techo: 0, consumido: 0, remanente: 0 };
  if (pErr) throw new Error(pErr.message);

  const techo = Math.max(0, Number(partida?.monto_total_estimado ?? 0));

  const { data: horas, error: hErr } = await supabase
    .from('ci_maquinaria_control_horas')
    .select('costo_venta_cliente')
    .eq('ci_presupuesto_partida_id', partidaId);

  if (hErr?.code === '42P01') return { techo, consumido: 0, remanente: techo };
  if (hErr) throw new Error(hErr.message);

  const consumido = (horas ?? []).reduce(
    (s, r) => s + Math.max(0, Number(r.costo_venta_cliente ?? 0)),
    0,
  );
  const remanente = Math.max(0, techo - consumido);
  return { techo, consumido, remanente };
}
