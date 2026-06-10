import type { SupabaseClient } from '@supabase/supabase-js';

export type CapituloMaestro = {
  id: string;
  codigo: string;
  nombre: string;
};

export async function listarCapitulosMaestro(
  supabase: SupabaseClient,
  limite = 30,
): Promise<CapituloMaestro[]> {
  const { data, error } = await supabase
    .from('ci_compras_capitulos_maestro')
    .select('id, codigo, nombre')
    .eq('activo', true)
    .order('codigo')
    .limit(limite);

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: String(r.id),
    codigo: String(r.codigo ?? ''),
    nombre: String(r.nombre ?? ''),
  }));
}

export async function obtenerCapituloMaestroPorId(
  supabase: SupabaseClient,
  id: string,
): Promise<CapituloMaestro | null> {
  const { data, error } = await supabase
    .from('ci_compras_capitulos_maestro')
    .select('id, codigo, nombre')
    .eq('id', id.trim())
    .maybeSingle();

  if (error?.code === '42P01') return null;
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: String(data.id),
    codigo: String(data.codigo ?? ''),
    nombre: String(data.nombre ?? ''),
  };
}

/** Etiqueta legible: título del capítulo (p. ej. «Obras civiles»), no el código CAP-I. */
export function etiquetaCapituloMaestro(c: Pick<CapituloMaestro, 'codigo' | 'nombre'>): string {
  const nombre = c.nombre?.trim();
  if (nombre) return nombre;
  return c.codigo?.trim() || 'Capítulo';
}

/** Teclado inline 2 columnas para elegir capítulo. */
export function tecladoCapitulosMaestro(
  capitulos: CapituloMaestro[],
  prefix: string,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  let row: Array<{ text: string; callback_data: string }> = [];

  for (const c of capitulos) {
    const label = etiquetaCapituloMaestro(c).slice(0, 64);
    row.push({ text: label, callback_data: `${prefix}${c.id}` });
    if (row.length >= 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  rows.push([{ text: '❌ Cancelar', callback_data: `${prefix}cancel` }]);
  return { inline_keyboard: rows };
}
