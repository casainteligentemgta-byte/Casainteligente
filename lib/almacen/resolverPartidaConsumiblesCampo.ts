import type { SupabaseClient } from '@supabase/supabase-js';

const PATRON_CAPITULO =
  /construcciones\s+provisionales|gastos\s+de\s+obra|construccion\s+provisional/i;

type PartidaRow = {
  id: string;
  codigo_partida?: string | null;
  descripcion?: string | null;
  capitulo_orden?: number | null;
  capitulo_codigo?: string | null;
  capitulo_descripcion?: string | null;
};

function coincideCapituloOperacional(row: PartidaRow): boolean {
  const blob = [
    row.capitulo_descripcion,
    row.descripcion,
    row.codigo_partida,
    row.capitulo_codigo,
  ]
    .filter(Boolean)
    .join(' ');
  return PATRON_CAPITULO.test(blob);
}

/**
 * Partida Lulo para consumibles de campo (agua, hielo, higiene):
 * capítulo 1 o título operacional de construcciones provisionales.
 */
export async function resolverPartidaConsumiblesCampo(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ci_presupuesto_partidas')
    .select(
      'id,codigo_partida,descripcion,capitulo_orden,capitulo_codigo,capitulo_descripcion',
    )
    .eq('proyecto_id', proyectoId)
    .order('capitulo_orden', { ascending: true })
    .order('codigo_partida', { ascending: true })
    .limit(500);

  if (error?.code === '42P01') return null;
  if (error) throw new Error(error.message);

  const filas = (data ?? []) as PartidaRow[];
  const porNombre = filas.find((r) => coincideCapituloOperacional(r));
  if (porNombre?.id) return String(porNombre.id);

  const capUno = filas.find(
    (r) =>
      Number(r.capitulo_orden) === 1 ||
      String(r.capitulo_codigo ?? '').trim() === '1',
  );
  if (capUno?.id) return String(capUno.id);

  return filas[0]?.id ? String(filas[0].id) : null;
}
