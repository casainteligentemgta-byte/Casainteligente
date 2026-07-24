import type { SupabaseClient } from '@supabase/supabase-js';

/** Escapa caracteres especiales de ILIKE. */
export function escapeIlike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function patronIlike(term: string): string {
  const t = escapeIlike(term.trim());
  return t ? `%${t}%` : '';
}

/** Interpreta texto como monto (150, 150.50, 150,50). */
export function parseMontoBusqueda(term: string): number | null {
  const raw = term.trim().replace(/\s/g, '').replace(',', '.');
  if (!raw || !/^-?\d+(\.\d{1,2})?$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseMontoFiltro(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  return parseMontoBusqueda(t);
}

/** IDs de compras con líneas que coinciden por descripción o código. */
export async function compraIdsPorArticulo(
  supabase: SupabaseClient,
  term: string,
): Promise<string[]> {
  const pattern = patronIlike(term);
  if (!pattern) return [];

  const [byDesc, byCode] = await Promise.all([
    supabase.from('contabilidad_compra_lineas').select('compra_id').ilike('descripcion', pattern).limit(400),
    supabase.from('contabilidad_compra_lineas').select('compra_id').ilike('item_code', pattern).limit(400),
  ]);

  const ids = new Set<string>();
  for (const row of [...(byDesc.data ?? []), ...(byCode.data ?? [])]) {
    if (row.compra_id) ids.add(row.compra_id);
  }
  return Array.from(ids);
}

/** IDs de compras con al menos una línea en rango de cantidad. */
export async function compraIdsPorCantidad(
  supabase: SupabaseClient,
  cantidadMin: number | null,
  cantidadMax: number | null,
): Promise<string[]> {
  if (cantidadMin === null && cantidadMax === null) return [];

  let q = supabase.from('contabilidad_compra_lineas').select('compra_id').limit(800);
  if (cantidadMin !== null) q = q.gte('cantidad', cantidadMin);
  if (cantidadMax !== null) q = q.lte('cantidad', cantidadMax);

  const { data, error } = await q;
  if (error) throw error;

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.compra_id) ids.add(row.compra_id);
  }
  return Array.from(ids);
}

/** Cláusula .or() para búsqueda libre en cabecera + IDs por artículo. */
export function orFiltroBusquedaCompras(term: string, compraIdsArticulo: string[]): string | null {
  const t = term.trim();
  if (!t) return null;

  const pattern = patronIlike(t);
  const parts: string[] = [];

  if (pattern) {
    parts.push(`supplier_name.ilike.${pattern}`);
    parts.push(`supplier_rif.ilike.${pattern}`);
    parts.push(`invoice_number.ilike.${pattern}`);
  }

  const monto = parseMontoBusqueda(t);
  if (monto !== null) {
    parts.push(`total_amount.eq.${monto}`);
  }

  if (compraIdsArticulo.length > 0) {
    parts.push(`id.in.(${compraIdsArticulo.join(',')})`);
  }

  return parts.length > 0 ? parts.join(',') : null;
}

export type ProveedorOpcion = { nombre: string; rif: string };

export function dedupeProveedores(
  rows: { supplier_name: string; supplier_rif: string }[]
): ProveedorOpcion[] {
  const map = new Map<string, ProveedorOpcion>();
  for (const r of rows) {
    const nombre = (r.supplier_name || '').trim();
    if (!nombre) continue;
    const key = nombre.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { nombre, rif: (r.supplier_rif || '').trim() });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
