import type { SupabaseClient } from '@supabase/supabase-js';

export type MaterialCategoryRow = {
  id: string;
  name: string;
};

/** Categorías sugeridas al ingresar facturas (se crean en BD si faltan). */
export const CATEGORIAS_COMPRA_SUGERIDAS = [
  'Materiales',
  'Herramientas',
  'Equipos',
  'Servicios',
  'Consumibles / Logística de Campo',
] as const;

export type CategoriaCompraSugerida = (typeof CATEGORIAS_COMPRA_SUGERIDAS)[number];

export const CATEGORIA_CONSUMIBLES_CAMPO = 'Consumibles / Logística de Campo';

export async function listarCategoriasMaterial(
  supabase: SupabaseClient,
): Promise<MaterialCategoryRow[]> {
  const { data, error } = await supabase
    .from('material_categories')
    .select('id, name')
    .order('name');
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? '').trim(),
  }));
}

export async function asegurarCategoriasCompraSugeridas(
  supabase: SupabaseClient,
): Promise<MaterialCategoryRow[]> {
  const actuales = await listarCategoriasMaterial(supabase);
  const nombres = new Set(actuales.map((c) => c.name.toLowerCase()));

  for (const nombre of CATEGORIAS_COMPRA_SUGERIDAS) {
    if (nombres.has(nombre.toLowerCase())) continue;
    const { error } = await supabase.from('material_categories').insert({
      name: nombre,
      level: 1,
      parent_id: null,
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(error.message);
    }
  }

  return listarCategoriasMaterial(supabase);
}

export function resolverCategoriaPorDefecto(categorias: MaterialCategoryRow[]): string {
  if (!categorias.length) return '';
  const preferidas = ['Materiales', 'Servicios', 'Herramientas'];
  for (const nombre of preferidas) {
    const hit = categorias.find((c) => c.name.toLowerCase() === nombre.toLowerCase());
    if (hit) return hit.id;
  }
  return categorias[0].id;
}

export function buscarCategoriaPorId(
  categorias: MaterialCategoryRow[],
  id: string,
): MaterialCategoryRow | null {
  const t = id.trim();
  if (!t) return null;
  return categorias.find((c) => c.id === t) ?? null;
}

export async function crearCategoriaMaterial(
  supabase: SupabaseClient,
  nombre: string,
): Promise<MaterialCategoryRow> {
  const name = nombre.trim();
  if (name.length < 2) {
    throw new Error('El nombre de la categoría debe tener al menos 2 caracteres.');
  }

  const { data: existente } = await supabase
    .from('material_categories')
    .select('id, name')
    .ilike('name', name)
    .maybeSingle();
  if (existente?.id) {
    return { id: String(existente.id), name: String(existente.name) };
  }

  const { data, error } = await supabase
    .from('material_categories')
    .insert({ name, level: 1, parent_id: null })
    .select('id, name')
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data.id), name: String(data.name) };
}
