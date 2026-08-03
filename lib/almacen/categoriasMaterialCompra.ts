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

/** Chips de filtro en cuadros (inventario / lo comprado). Coincidencia flexible por nombre. */
export const CATEGORIAS_FILTRO_CUADRO = [
  'Todos',
  'Materiales',
  'Insumos',
  'Herramientas',
  'Maquinaria',
  'Servicios',
  'Consumibles',
  'Combustibles',
  'EPP',
] as const;

export type CategoriaFiltroCuadro = (typeof CATEGORIAS_FILTRO_CUADRO)[number];

export function parseCategoriaFiltroCuadro(raw: string | null | undefined): CategoriaFiltroCuadro {
  const t = String(raw ?? '').trim();
  if ((CATEGORIAS_FILTRO_CUADRO as readonly string[]).includes(t)) {
    return t as CategoriaFiltroCuadro;
  }
  return 'Todos';
}

/**
 * ¿El nombre de categoría (o texto auxiliar) encaja con el chip de filtro?
 * Misma lógica flexible que el cuadro de inventario.
 */
export function categoriaNombreCoincideFiltro(
  nombreCategoria: string | null | undefined,
  filtro: string,
  textoAuxiliar?: string | null,
): boolean {
  if (!filtro || filtro === 'Todos') return true;
  const n = `${nombreCategoria ?? ''} ${textoAuxiliar ?? ''}`.toLowerCase();
  switch (filtro) {
    case 'Materiales':
      return n.includes('material');
    case 'Insumos':
      return n.includes('insumo');
    case 'Herramientas':
      return n.includes('herramient');
    case 'Maquinaria':
      return n.includes('maquinaria') || n.includes('equipo');
    case 'Servicios':
      return n.includes('servicio') || n.includes('alquiler');
    case 'Consumibles':
      return (
        n.includes('consumib') ||
        n.includes('logística de campo') ||
        n.includes('logistica de campo')
      );
    case 'Combustibles':
      return n.includes('combustib');
    case 'EPP':
      return n.includes('epp') || n.includes('protección') || n.includes('proteccion');
    default:
      return true;
  }
}

/** Mapa material_id → nombre de categoría (material_categories). */
export async function mapNombreCategoriaPorMaterialIds(
  supabase: SupabaseClient,
  materialIds: readonly string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(
    new Set(materialIds.map((id) => id.trim()).filter(Boolean)),
  );
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('global_inventory')
      .select('id, category:material_categories(name)')
      .in('id', chunk);
    if (error) {
      if (error.code === '42P01') return map;
      throw new Error(error.message);
    }
    for (const row of data ?? []) {
      const raw = (row as { category?: { name?: string | null } | { name?: string | null }[] | null })
        .category;
      const cat = Array.isArray(raw) ? raw[0] : raw;
      const nombre = String(cat?.name ?? '').trim();
      if (nombre) map.set(String((row as { id: string }).id), nombre);
    }
  }
  return map;
}

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
