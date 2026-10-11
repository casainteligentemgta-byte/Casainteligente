import type { SupabaseClient } from '@supabase/supabase-js';

export const CATEGORIAS_COMERCIALES_DEFAULT = [
  'Cámaras IP',
  'Cámaras Análogas',
  'C.C.T.V',
  'Servicio',
  'Cercos Eléctricos',
  'Internet',
  'Domótica',
  'Network',
] as const;

export const CATEGORIAS_INTERNAS_DEFAULT = [
  'Materiales',
  'Herramientas',
  'Insumos',
  'Consumibles',
] as const;

export const CATEGORIAS_CATALOGO_DEFAULT = [
  ...CATEGORIAS_COMERCIALES_DEFAULT,
  ...CATEGORIAS_INTERNAS_DEFAULT,
] as const;

export const CAT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Cámaras IP': { bg: 'rgba(0,122,255,0.12)', text: '#007AFF', dot: '#007AFF' },
  'Cámaras Análogas': { bg: 'rgba(88,86,214,0.12)', text: '#5856D6', dot: '#5856D6' },
  'C.C.T.V': { bg: 'rgba(88,86,214,0.12)', text: '#5856D6', dot: '#5856D6' },
  Servicio: { bg: 'rgba(52,199,89,0.12)', text: '#34C759', dot: '#34C759' },
  'Cercos Eléctricos': { bg: 'rgba(255,149,0,0.12)', text: '#FF9500', dot: '#FF9500' },
  Internet: { bg: 'rgba(0,199,190,0.12)', text: '#00C7BE', dot: '#00C7BE' },
  Domótica: { bg: 'rgba(255,45,85,0.12)', text: '#FF2D55', dot: '#FF2D55' },
  Network: { bg: 'rgba(0,199,190,0.12)', text: '#00C7BE', dot: '#00C7BE' },
  Materiales: { bg: 'rgba(142,142,147,0.12)', text: '#8E8E93', dot: '#8E8E93' },
  Herramientas: { bg: 'rgba(255,149,0,0.12)', text: '#FF9500', dot: '#FF9500' },
  Insumos: { bg: 'rgba(175,82,222,0.12)', text: '#AF52DE', dot: '#AF52DE' },
  Consumibles: { bg: 'rgba(90,200,250,0.12)', text: '#5AC8FA', dot: '#5AC8FA' },
};

const PALETA_NUEVAS = [
  '#007AFF',
  '#5856D6',
  '#34C759',
  '#FF9500',
  '#00C7BE',
  '#FF2D55',
  '#AF52DE',
  '#5AC8FA',
  '#FFD60A',
  '#FF6482',
] as const;

export const CATEGORIAS_EXTRAS_LS_KEY = 'ci-productos-categorias-extra-v1';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function colorHexCategoria(nombre: string | null | undefined): string {
  const cat = (nombre ?? '').trim();
  if (!cat) return '#8E8E93';
  const known = CAT_COLORS[cat];
  if (known) return known.dot;
  let hash = 0;
  for (let i = 0; i < cat.length; i += 1) {
    hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
  }
  return PALETA_NUEVAS[hash % PALETA_NUEVAS.length];
}

export function coloresCategoria(nombre: string | null | undefined): {
  bg: string;
  text: string;
  dot: string;
} {
  const cat = (nombre ?? '').trim();
  if (cat && CAT_COLORS[cat]) return CAT_COLORS[cat];
  const hex = colorHexCategoria(cat);
  return { bg: hexToRgba(hex, 0.12), text: hex, dot: hex };
}

/**
 * Clave para comparar nombres: sin mayúsculas, sin acentos y sin espacios de más.
 * «Domotica» y «Domótica» son la misma categoría.
 */
export function claveNombreCategoria(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function claveNombre(nombre: string): string {
  return claveNombreCategoria(nombre);
}

/**
 * Devuelve la categoría ya existente que equivale a `nombre` (ignorando acentos y
 * mayúsculas), o `null` si es nueva. Evita crear «Domotica» cuando ya hay «Domótica».
 */
export function categoriaExistenteEquivalente(
  nombre: string,
  existentes: readonly string[],
): string | null {
  const clave = claveNombreCategoria(nombre);
  if (!clave) return null;
  for (const e of existentes) {
    if (claveNombreCategoria(e) === clave) return normalizarNombreCategoria(e);
  }
  return null;
}

export function normalizarNombreCategoria(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function validarNombreCategoria(raw: string): string {
  const name = normalizarNombreCategoria(raw);
  if (name.length < 2) {
    throw new Error('Indique un nombre de categoría válido (mínimo 2 caracteres).');
  }
  if (name.length > 60) {
    throw new Error('El nombre no puede superar 60 caracteres.');
  }
  if (/^todas?$/i.test(name)) {
    throw new Error('Ese nombre está reservado para el filtro general.');
  }
  return name;
}

export function mergeNombresCategoria(...grupos: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const grupo of grupos) {
    for (const raw of grupo) {
      const name = normalizarNombreCategoria(raw);
      if (!name) continue;
      const key = claveNombre(name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

export function leerCategoriasExtrasLocal(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CATEGORIAS_EXTRAS_LS_KEY);
    const parsed = JSON.parse(raw || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  } catch {
    return [];
  }
}

export function guardarCategoriaExtraLocal(nombre: string): void {
  if (typeof window === 'undefined') return;
  const name = normalizarNombreCategoria(nombre);
  if (!name) return;
  const extras = mergeNombresCategoria(leerCategoriasExtrasLocal(), [name]);
  try {
    localStorage.setItem(CATEGORIAS_EXTRAS_LS_KEY, JSON.stringify(extras));
  } catch {
    /* ignore quota */
  }
}

function esTablaAusente(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  return code === '42P01' || msg.includes('schema cache') || msg.includes('does not exist');
}

async function listarDesdeTabla(supabase: SupabaseClient): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('product_categories')
    .select('name, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    if (esTablaAusente(error)) return null;
    return null;
  }
  return (data ?? [])
    .map((r) => normalizarNombreCategoria(String((r as { name?: string }).name ?? '')))
    .filter(Boolean);
}

async function listarDesdeProductos(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('products')
    .select('categoria')
    .not('categoria', 'is', null)
    .limit(4000);
  if (error || !data) return [];
  return data
    .map((r) => normalizarNombreCategoria(String((r as { categoria?: string | null }).categoria ?? '')))
    .filter(Boolean);
}

/** Las categorías «extra» que algún navegador guardó antes de existir la tabla. */
function olvidarCategoriasExtrasLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CATEGORIAS_EXTRAS_LS_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Qué categorías se muestran.
 *
 * La tabla `product_categories` manda. Antes, cada navegador volvía a crear en la tabla
 * las categorías que tenía guardadas en su memoria local, así que una categoría borrada
 * («Opción 3») reaparecía sola. Ahora la memoria local solo se usa si la tabla no responde.
 */
export function categoriasAMostrar(
  deTabla: readonly string[] | null,
  deProductos: readonly string[],
  extrasLocales: readonly string[],
): string[] {
  if (deTabla && deTabla.length > 0) {
    return mergeNombresCategoria(CATEGORIAS_CATALOGO_DEFAULT, deTabla);
  }
  return mergeNombresCategoria(CATEGORIAS_CATALOGO_DEFAULT, deProductos, extrasLocales);
}

export async function listarCategoriasCatalogo(supabase: SupabaseClient): Promise<string[]> {
  let fromTable: string[] | null = null;
  try {
    fromTable = await listarDesdeTabla(supabase);
  } catch {
    fromTable = null;
  }

  if (fromTable && fromTable.length > 0) {
    olvidarCategoriasExtrasLocal();
    return categoriasAMostrar(fromTable, [], []);
  }

  let fromProducts: string[] = [];
  try {
    fromProducts = await listarDesdeProductos(supabase);
  } catch {
    fromProducts = [];
  }
  return categoriasAMostrar(fromTable, fromProducts, leerCategoriasExtrasLocal());
}

export async function crearCategoriaCatalogo(
  supabase: SupabaseClient,
  rawNombre: string,
): Promise<string> {
  const name = validarNombreCategoria(rawNombre);
  const color = colorHexCategoria(name);

  try {
    // ¿Ya existe con otro acento o mayúsculas? Se usa la que ya está.
    const enTabla = (await listarDesdeTabla(supabase)) ?? [];
    const existenteNombre = categoriaExistenteEquivalente(name, [
      ...CATEGORIAS_CATALOGO_DEFAULT,
      ...enTabla,
    ]);
    if (existenteNombre) return existenteNombre;

    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        name,
        kind: 'personalizada',
        sort_order: 500,
        color,
      })
      .select('name')
      .single();

    if (!error && data?.name) {
      return normalizarNombreCategoria(String(data.name));
    }

    if (error && /duplicate|unique/i.test(error.message)) {
      const { data: dup } = await supabase
        .from('product_categories')
        .select('name')
        .ilike('name', name)
        .maybeSingle();
      return normalizarNombreCategoria(String(dup?.name ?? '')) || name;
    }
  } catch {
    /* tabla ausente o red: se guarda en local */
  }

  guardarCategoriaExtraLocal(name);
  return name;
}
