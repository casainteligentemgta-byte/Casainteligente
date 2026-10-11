/**
 * Ayudas del catálogo de productos: qué fichas están incompletas («por corregir»),
 * búsqueda segura y aviso antes de eliminar. Funciones puras, con pruebas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type RevisionCatalogo = 'sin_precio' | 'sin_categoria' | 'repetidos';

export const REVISIONES_CATALOGO: Array<{ id: RevisionCatalogo; etiqueta: string }> = [
  { id: 'sin_precio', etiqueta: 'Sin precio' },
  { id: 'sin_categoria', etiqueta: 'Sin categoría' },
  { id: 'repetidos', etiqueta: 'Repetidos' },
];

type ProductoRevisable = {
  id: number;
  nombre?: string | null;
  categoria?: string | null;
  precio?: number | null;
};

function claveNombreProducto(nombre: string | null | undefined): string {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function productoSinPrecio(p: ProductoRevisable): boolean {
  const n = Number(p.precio);
  return p.precio == null || !Number.isFinite(n) || n <= 0;
}

export function productoSinCategoria(p: ProductoRevisable): boolean {
  return String(p.categoria ?? '').trim() === '';
}

/** Ids de los productos cuyo nombre aparece más de una vez (sin distinguir acentos ni mayúsculas). */
export function idsDeNombresRepetidos(productos: readonly ProductoRevisable[]): Set<number> {
  const porNombre = new Map<string, number[]>();
  for (const p of productos) {
    const clave = claveNombreProducto(p.nombre);
    if (!clave) continue;
    const lista = porNombre.get(clave);
    if (lista) lista.push(p.id);
    else porNombre.set(clave, [p.id]);
  }
  const ids = new Set<number>();
  porNombre.forEach((lista) => {
    if (lista.length > 1) lista.forEach((id) => ids.add(id));
  });
  return ids;
}

export function contarPorCorregir(
  productos: readonly ProductoRevisable[],
): Record<RevisionCatalogo, number> {
  return {
    sin_precio: productos.filter(productoSinPrecio).length,
    sin_categoria: productos.filter(productoSinCategoria).length,
    repetidos: idsDeNombresRepetidos(productos).size,
  };
}

export function filtrarPorCorregir<T extends ProductoRevisable>(
  productos: readonly T[],
  revision: RevisionCatalogo | '',
): T[] {
  if (revision === 'sin_precio') return productos.filter(productoSinPrecio);
  if (revision === 'sin_categoria') return productos.filter(productoSinCategoria);
  if (revision === 'repetidos') {
    const ids = idsDeNombresRepetidos(productos);
    // Juntos por nombre, para comparar las copias una al lado de la otra.
    return productos
      .filter((p) => ids.has(p.id))
      .sort((a, b) => claveNombreProducto(a.nombre).localeCompare(claveNombreProducto(b.nombre)) || a.id - b.id);
  }
  return [...productos];
}

/**
 * Texto de búsqueda listo para el filtro `or(...)` de la base: sin los signos que ese
 * filtro usa como separadores (coma, paréntesis) ni comodines. Antes, buscar
 * «cable 2x18, rojo» hacía fallar la consulta y la lista quedaba como estaba.
 */
export function terminoBusquedaCatalogo(texto: string): string {
  return texto
    .replace(/[,()*%\\"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type UsoProducto = { presupuestos: number; almacen: number };

/**
 * Pregunta antes de eliminar un producto que está en uso, o `null` si no lo está
 * (basta la confirmación normal de dos toques).
 */
export function avisoEliminarProducto(nombre: string, uso: UsoProducto): string | null {
  const partes: string[] = [];
  if (uso.presupuestos > 0) {
    partes.push(
      `está en ${uso.presupuestos} presupuesto${uso.presupuestos === 1 ? '' : 's'} (los presupuestos guardados no cambian)`,
    );
  }
  if (uso.almacen > 0) {
    partes.push(
      `tiene ${uso.almacen} artículo${uso.almacen === 1 ? '' : 's'} de almacén enlazado${uso.almacen === 1 ? '' : 's'} (quedarán sin producto de catálogo)`,
    );
  }
  if (partes.length === 0) return null;
  return `«${nombre}» ${partes.join(' y ')}.\n\nSi lo eliminas ya no se podrá agregar a presupuestos nuevos. ¿Eliminar de todos modos?`;
}

/** Dónde se usa un producto. Si no se puede saber, devuelve el error (y no se elimina). */
export async function usoDeProducto(
  supabase: SupabaseClient,
  productoId: number,
): Promise<{ uso: UsoProducto; error: string | null }> {
  const [pres, alm] = await Promise.all([
    supabase.from('budgets').select('id').contains('items', JSON.stringify([{ product_id: productoId }])),
    supabase.from('global_inventory').select('id').eq('product_id', productoId),
  ]);
  return {
    uso: {
      presupuestos: Array.isArray(pres.data) ? pres.data.length : 0,
      almacen: Array.isArray(alm.data) ? alm.data.length : 0,
    },
    error: pres.error?.message ?? alm.error?.message ?? null,
  };
}
