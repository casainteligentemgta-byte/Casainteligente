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

function claveNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
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

async function sincronizarExtrasEnTabla(
  supabase: SupabaseClient,
  extras: readonly string[],
  actuales: readonly string[],
): Promise<void> {
  const have = new Set(actuales.map((n) => n.toLowerCase()));
  for (const extra of extras) {
    const name = normalizarNombreCategoria(extra);
    if (!name || have.has(name.toLowerCase())) continue;
    const { error } = await supabase.from('product_categories').insert({
      name,
      kind: 'personalizada',
      sort_order: 500,
      color: colorHexCategoria(name),
    });
    if (!error) have.add(name.toLowerCase());
  }
}

export async function listarCategoriasCatalogo(supabase: SupabaseClient): Promise<string[]> {
  const extras = leerCategoriasExtrasLocal();
  let fromTable: string[] | null = null;
  try {
    fromTable = await listarDesdeTabla(supabase);
  } catch {
    fromTable = null;
  }

  if (fromTable && extras.length > 0) {
    try {
      await sincronizarExtrasEnTabla(supabase, extras, fromTable);
      fromTable = (await listarDesdeTabla(supabase)) ?? fromTable;
    } catch {
      /* ignore */
    }
  }

  let fromProducts: string[] = [];
  if (!fromTable || fromTable.length === 0) {
    try {
      fromProducts = await listarDesdeProductos(supabase);
    } catch {
      fromProducts = [];
    }
  }

  return mergeNombresCategoria(
    CATEGORIAS_CATALOGO_DEFAULT,
    fromTable ?? [],
    fromProducts,
    extras,
  );
}

export async function crearCategoriaCatalogo(
  supabase: SupabaseClient,
  rawNombre: string,
): Promise<string> {
  const name = validarNombreCategoria(rawNombre);
  const color = colorHexCategoria(name);

  try {
    const { data: existente } = await supabase
      .from('product_categories')
      .select('name')
      .ilike('name', name)
      .maybeSingle();
    const existenteNombre = normalizarNombreCategoria(String(existente?.name ?? ''));
    if (existenteNombre) {
      guardarCategoriaExtraLocal(existenteNombre);
      return existenteNombre;
    }

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
      const creado = normalizarNombreCategoria(String(data.name));
      guardarCategoriaExtraLocal(creado);
      return creado;
    }

    if (error && /duplicate|unique/i.test(error.message)) {
      const { data: dup } = await supabase
        .from('product_categories')
        .select('name')
        .ilike('name', name)
        .maybeSingle();
      const dupName = normalizarNombreCategoria(String(dup?.name ?? '')) || name;
      guardarCategoriaExtraLocal(dupName);
      return dupName;
    }
  } catch {
    /* tabla ausente o red: se guarda en local */
  }

  guardarCategoriaExtraLocal(name);
  return name;
}
