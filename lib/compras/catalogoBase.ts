import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarMedidas } from '@/lib/compras/medidasMaterial';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';

/**
 * Catálogo base de obra civil (migración 361): lista general por categoría, sin precios,
 * para elegir el material en /procura. Al elegir un ítem se busca o crea el material
 * del catálogo de la empresa de la obra (global_inventory) y se enlaza por
 * catalogo_base_id, así el catálogo real se llena solo y ordenado.
 *
 * Si la migración no está aplicada, todo devuelve vacío y el bot sigue con texto libre.
 */

export type ItemCatalogoBase = {
  id: string;
  codigo: string;
  categoria: string;
  categoria_orden: number;
  grupo: string;
  nombre: string;
  unidad: string;
  palabras_clave: string | null;
  orden: number;
};

export type CategoriaCatalogoBase = { orden: number; nombre: string; items: number };

const TABLA = 'ci_catalogo_base';
const COLUMNAS = 'id,codigo,categoria,categoria_orden,grupo,nombre,unidad,palabras_clave,orden';

function mapItem(row: Record<string, unknown>): ItemCatalogoBase {
  return {
    id: String(row.id),
    codigo: String(row.codigo ?? ''),
    categoria: String(row.categoria ?? ''),
    categoria_orden: Number(row.categoria_orden ?? 0),
    grupo: String(row.grupo ?? 'Materiales'),
    nombre: String(row.nombre ?? ''),
    unidad: String(row.unidad ?? 'UND'),
    palabras_clave: row.palabras_clave == null ? null : String(row.palabras_clave),
    orden: Number(row.orden ?? 0),
  };
}

/** Todos los ítems activos (~300 filas: se leen de una vez y se filtran en memoria). */
export async function listarCatalogoBase(supabase: SupabaseClient): Promise<ItemCatalogoBase[]> {
  const { data, error } = await supabase
    .from(TABLA)
    .select(COLUMNAS)
    .eq('activo', true)
    .order('categoria_orden')
    .order('orden')
    .limit(2000);
  if (error) {
    if (!/ci_catalogo_base|does not exist|schema cache/i.test(error.message ?? '')) {
      console.warn('[catalogoBase] listar:', error.message);
    }
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapItem);
}

export function categoriasDeCatalogo(items: ItemCatalogoBase[]): CategoriaCatalogoBase[] {
  const porOrden = new Map<number, CategoriaCatalogoBase>();
  for (const i of items) {
    const c = porOrden.get(i.categoria_orden) ?? { orden: i.categoria_orden, nombre: i.categoria, items: 0 };
    c.items += 1;
    porOrden.set(i.categoria_orden, c);
  }
  return Array.from(porOrden.values()).sort((a, b) => a.orden - b.orden);
}

export function itemsDeCategoria(items: ItemCatalogoBase[], orden: number): ItemCatalogoBase[] {
  return items.filter((i) => i.categoria_orden === orden).sort((a, b) => a.orden - b.orden);
}

/**
 * Búsqueda tolerante: sin acentos ni mayúsculas, todas las palabras del término deben
 * aparecer en el nombre o en las palabras clave (en cualquier orden).
 */
/** Las medidas en fracción (1/2", 3/4") se buscan enteras: «1/2» no debe encontrar «1/4». */
function normalizarBusqueda(texto: string): string {
  return normalizarTextoMaterial(normalizarMedidas(texto));
}

export function buscarEnCatalogoBase(
  items: ItemCatalogoBase[],
  term: string,
  limit = 6,
): ItemCatalogoBase[] {
  const palabras = normalizarBusqueda(term)
    .split(' ')
    .filter((p) => p.length >= 2 || /\d/.test(p));
  if (!palabras.some((p) => p.length >= 2)) return [];
  const conPuntaje: Array<{ item: ItemCatalogoBase; puntaje: number }> = [];
  for (const item of items) {
    const nombre = normalizarBusqueda(item.nombre);
    const tokens = new Set(
      `${nombre} ${normalizarBusqueda(item.palabras_clave ?? '')} ${normalizarBusqueda(item.categoria)}`.split(' '),
    );
    const texto = Array.from(tokens).join(' ');
    // Palabras: por prefijo (cabil → cabilla); medidas y números: exactos.
    const coincide = (p: string) =>
      /\d/.test(p) ? tokens.has(p) : Array.from(tokens).some((t) => t.startsWith(p)) || texto.includes(p);
    if (!palabras.every(coincide)) continue;
    // Primero lo que coincide en el nombre y al inicio.
    const puntaje =
      palabras.filter((p) => nombre.includes(p)).length * 2 + (nombre.startsWith(palabras[0]) ? 1 : 0);
    conPuntaje.push({ item, puntaje });
  }
  return conPuntaje
    .sort((a, b) => b.puntaje - a.puntaje || a.item.categoria_orden - b.item.categoria_orden || a.item.orden - b.item.orden)
    .slice(0, limit)
    .map((c) => c.item);
}

export async function obtenerItemCatalogoBase(
  supabase: SupabaseClient,
  id: string,
): Promise<ItemCatalogoBase | null> {
  const { data, error } = await supabase.from(TABLA).select(COLUMNAS).eq('id', id.trim()).maybeSingle();
  if (error || !data) return null;
  return mapItem(data as Record<string, unknown>);
}

export type MaterialDesdeCatalogo = { id: string; name: string; unit: string; creado: boolean };

/**
 * Material de la empresa de la obra que corresponde al ítem del catálogo base:
 * el ya enlazado, o uno con el mismo nombre (se enlaza), o uno nuevo.
 */
export async function asegurarMaterialDesdeCatalogoBase(
  supabase: SupabaseClient,
  item: ItemCatalogoBase,
  ambito: { proyectoId: string | null; entidadId: string | null },
): Promise<MaterialDesdeCatalogo | null> {
  const entidadId = ambito.entidadId?.trim() || null;
  const proyectoId = ambito.proyectoId?.trim() || null;
  if (!entidadId && !proyectoId) return null;

  const columna = entidadId ? 'entidad_id' : 'proyecto_id';
  const valor = (entidadId ?? proyectoId) as string;

  try {
    const enlazado = await supabase
      .from('global_inventory')
      .select('id,name,unit')
      .eq('catalogo_base_id', item.id)
      .eq(columna, valor)
      .limit(1);
    const filaEnlazada = (enlazado.data ?? [])[0] as { id: string; name: string; unit: string } | undefined;
    if (filaEnlazada) {
      return { id: String(filaEnlazada.id), name: String(filaEnlazada.name), unit: String(filaEnlazada.unit ?? item.unidad), creado: false };
    }

    const mismoNombre = await supabase
      .from('global_inventory')
      .select('id,name,unit')
      .ilike('name', item.nombre.replace(/[%_]/g, ''))
      .eq(columna, valor)
      .limit(1);
    const filaNombre = (mismoNombre.data ?? [])[0] as { id: string; name: string; unit: string } | undefined;
    if (filaNombre) {
      await supabase.from('global_inventory').update({ catalogo_base_id: item.id }).eq('id', filaNombre.id);
      return { id: String(filaNombre.id), name: String(filaNombre.name), unit: String(filaNombre.unit ?? item.unidad), creado: false };
    }

    const { data: grupo } = await supabase
      .from('material_categories')
      .select('id')
      .eq('name', item.grupo)
      .limit(1);
    const categoryId = ((grupo ?? [])[0] as { id?: string } | undefined)?.id ?? null;

    const nuevo: Record<string, unknown> = {
      name: item.nombre,
      unit: item.unidad,
      category_name: item.categoria,
      catalogo_base_id: item.id,
      stock_available: 0,
      stock_quarantine: 0,
      reorder_point: 0,
      is_active: true,
    };
    if (categoryId) nuevo.category_id = categoryId;
    if (entidadId) nuevo.entidad_id = entidadId;
    if (proyectoId) nuevo.proyecto_id = proyectoId;

    const { data, error } = await supabase.from('global_inventory').insert(nuevo).select('id,name,unit').single();
    if (error || !data) {
      console.warn('[catalogoBase] crear material:', error?.message);
      return null;
    }
    const fila = data as { id: string; name: string; unit: string };
    return { id: String(fila.id), name: String(fila.name), unit: String(fila.unit ?? item.unidad), creado: true };
  } catch (e) {
    console.warn('[catalogoBase] asegurar material:', e);
    return null;
  }
}
