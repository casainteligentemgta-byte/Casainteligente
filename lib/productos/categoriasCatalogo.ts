import type { SupabaseClient } from '@supabase/supabase-js';

/** Categoría que reúne cámaras, grabadores y sus accesorios. */
export const CATEGORIA_CCTV = 'CCTV';

export const CATEGORIAS_COMERCIALES_DEFAULT = [
  CATEGORIA_CCTV,
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

/**
 * Subcategorías de fábrica. «Cámaras IP» y «Cámaras Análogas» eran categorías sueltas:
 * ahora viven dentro de CCTV. El dueño puede crear más desde Productos.
 */
export const SUBCATEGORIAS_DEFAULT: Record<string, readonly string[]> = {
  [CATEGORIA_CCTV]: ['Cámaras IP', 'Cámaras Análogas', 'Otros dispositivos', 'Accesorios'],
};

export type ArbolCategorias = {
  /** Categorías principales, en orden. */
  categorias: string[];
  /** Subcategorías de cada categoría (clave: nombre de la categoría tal como se muestra). */
  subcategorias: Record<string, string[]>;
};

export const CAT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Cámaras IP': { bg: 'rgba(0,122,255,0.12)', text: '#007AFF', dot: '#007AFF' },
  'Cámaras Análogas': { bg: 'rgba(88,86,214,0.12)', text: '#5856D6', dot: '#5856D6' },
  CCTV: { bg: 'rgba(88,86,214,0.12)', text: '#5856D6', dot: '#5856D6' },
  // Nombre anterior de CCTV: los presupuestos viejos lo guardan en sus renglones.
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
 * Clave para comparar nombres: sin mayúsculas, sin acentos, sin puntos y sin espacios de
 * más. «Domotica» y «Domótica» son la misma categoría; «C.C.T.V» y «CCTV», también.
 */
export function claveNombreCategoria(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // «C.C.T.V» y «CCTV» son la misma: los puntos de una sigla no cuentan.
    .replace(/\./g, '')
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

export type FilaCategoria = { id: string; name: string; parent_id: string | null };

/**
 * De las filas de `product_categories` al árbol: las que no tienen madre son categorías;
 * las demás cuelgan de la suya. Una subcategoría cuya madre ya no existe no se muestra.
 */
export function arbolDeFilas(filas: readonly FilaCategoria[]): ArbolCategorias {
  const nombrePorId: Record<string, string> = {};
  const categorias: string[] = [];
  for (const f of filas) {
    const nombre = normalizarNombreCategoria(f.name);
    if (!nombre || f.parent_id) continue;
    nombrePorId[f.id] = nombre;
    categorias.push(nombre);
  }
  const subcategorias: Record<string, string[]> = {};
  for (const f of filas) {
    const nombre = normalizarNombreCategoria(f.name);
    const madre = f.parent_id ? nombrePorId[f.parent_id] : undefined;
    if (!nombre || !madre) continue;
    subcategorias[madre] = mergeNombresCategoria(subcategorias[madre] ?? [], [nombre]);
  }
  return { categorias: mergeNombresCategoria(categorias), subcategorias };
}

/** Subcategorías de una categoría (sin distinguir acentos ni mayúsculas en el nombre). */
export function subcategoriasDe(arbol: Pick<ArbolCategorias, 'subcategorias'>, categoria: string | null | undefined): string[] {
  const clave = claveNombreCategoria(categoria ?? '');
  if (!clave) return [];
  for (const nombre of Object.keys(arbol.subcategorias)) {
    if (claveNombreCategoria(nombre) === clave) return arbol.subcategorias[nombre] ?? [];
  }
  return [];
}

/**
 * Subcategorías que se muestran: las de fábrica más las de la tabla, cada una bajo el
 * nombre de su categoría tal como aparece en `categorias`.
 */
export function subcategoriasAMostrar(
  categorias: readonly string[],
  deTabla: Readonly<Record<string, readonly string[]>> | null,
): Record<string, string[]> {
  const salida: Record<string, string[]> = {};
  for (const categoria of categorias) {
    const deFabrica = subcategoriasDe({ subcategorias: SUBCATEGORIAS_DEFAULT as Record<string, string[]> }, categoria);
    const guardadas = deTabla ? subcategoriasDe({ subcategorias: deTabla as Record<string, string[]> }, categoria) : [];
    const todas = mergeNombresCategoria(deFabrica, guardadas);
    if (todas.length > 0) salida[categoria] = todas;
  }
  return salida;
}

/** «CCTV › Cámaras IP», o solo la categoría si el producto no tiene subcategoría. */
export function etiquetaCategoria(categoria: string | null | undefined, subcategoria: string | null | undefined): string {
  const c = normalizarNombreCategoria(categoria ?? '');
  const sub = normalizarNombreCategoria(subcategoria ?? '');
  if (!c) return '';
  return sub ? `${c} › ${sub}` : c;
}

/** Lo contrario de `etiquetaCategoria`: de «CCTV › Cámaras IP» a sus dos partes. */
export function separarEtiquetaCategoria(etiqueta: string | null | undefined): { categoria: string; subcategoria: string } {
  const texto = String(etiqueta ?? '');
  const corte = texto.indexOf(' › ');
  if (corte < 0) return { categoria: normalizarNombreCategoria(texto), subcategoria: '' };
  return {
    categoria: normalizarNombreCategoria(texto.slice(0, corte)),
    subcategoria: normalizarNombreCategoria(texto.slice(corte + 3)),
  };
}

/** Opciones para un desplegable: cada categoría y, debajo, cada una de sus subcategorías. */
export function opcionesCategoriaConSub(arbol: ArbolCategorias): string[] {
  const salida: string[] = [];
  for (const categoria of arbol.categorias) {
    salida.push(categoria);
    for (const sub of subcategoriasDe(arbol, categoria)) salida.push(etiquetaCategoria(categoria, sub));
  }
  return salida;
}

async function filasDeTabla(supabase: SupabaseClient): Promise<FilaCategoria[] | null> {
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, name, parent_id, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) return null;
  return (data ?? []).map((r) => {
    const fila = r as { id?: string; name?: string; parent_id?: string | null };
    return { id: String(fila.id ?? ''), name: String(fila.name ?? ''), parent_id: fila.parent_id ?? null };
  });
}

async function listarDesdeTabla(supabase: SupabaseClient): Promise<string[] | null> {
  const filas = await filasDeTabla(supabase);
  return filas ? arbolDeFilas(filas).categorias : null;
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

/** Categorías y subcategorías que se muestran en Productos y en el presupuesto. */
export async function listarArbolCategorias(supabase: SupabaseClient): Promise<ArbolCategorias> {
  let arbol: ArbolCategorias | null = null;
  try {
    const filas = await filasDeTabla(supabase);
    arbol = filas ? arbolDeFilas(filas) : null;
  } catch {
    arbol = null;
  }
  const categorias =
    arbol && arbol.categorias.length > 0
      ? categoriasAMostrar(arbol.categorias, [], [])
      : await listarCategoriasCatalogo(supabase);
  return { categorias, subcategorias: subcategoriasAMostrar(categorias, arbol ? arbol.subcategorias : null) };
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
        .is('parent_id', null)
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

export function validarNombreSubcategoria(raw: string): string {
  const name = normalizarNombreCategoria(raw);
  if (name.length < 2) {
    throw new Error('Indique un nombre de subcategoría válido (mínimo 2 caracteres).');
  }
  if (name.length > 60) {
    throw new Error('El nombre no puede superar 60 caracteres.');
  }
  if (/^todas?$/i.test(name)) {
    throw new Error('Ese nombre está reservado para el filtro general.');
  }
  return name;
}

/**
 * Crea una subcategoría dentro de `categoria` y devuelve su nombre. Si ya existe con otro
 * acento o mayúsculas, devuelve la que ya está. Si la categoría no está en la tabla
 * (venía solo de fábrica), la crea primero.
 */
export async function crearSubcategoriaCatalogo(
  supabase: SupabaseClient,
  rawCategoria: string,
  rawNombre: string,
): Promise<string> {
  const categoria = normalizarNombreCategoria(rawCategoria);
  if (!categoria) throw new Error('Elija primero la categoría.');
  const name = validarNombreSubcategoria(rawNombre);

  const deFabrica = subcategoriasDe({ subcategorias: SUBCATEGORIAS_DEFAULT as Record<string, string[]> }, categoria);
  const filas = (await filasDeTabla(supabase)) ?? [];
  const arbol = arbolDeFilas(filas);
  const existente = categoriaExistenteEquivalente(name, [...subcategoriasDe(arbol, categoria), ...deFabrica]);
  const claveCategoria = claveNombreCategoria(categoria);
  let madre = filas.find((f) => !f.parent_id && claveNombreCategoria(f.name) === claveCategoria);
  // Ya está guardada bajo esta categoría: no hay nada que crear.
  if (existente && madre && filas.some((f) => f.parent_id === madre!.id && claveNombreCategoria(f.name) === claveNombreCategoria(existente))) {
    return existente;
  }

  if (!madre) {
    const creada = await crearCategoriaCatalogo(supabase, categoria);
    const { data } = await supabase
      .from('product_categories')
      .select('id, name, parent_id')
      .is('parent_id', null)
      .ilike('name', creada)
      .maybeSingle();
    if (!data?.id) throw new Error('No se pudo guardar la subcategoría: la categoría no está en la base de datos.');
    madre = { id: String(data.id), name: String(data.name ?? creada), parent_id: null };
  }

  const nombreFinal = existente ?? name;
  const { error } = await supabase.from('product_categories').insert({
    name: nombreFinal,
    kind: 'personalizada',
    sort_order: 500,
    parent_id: madre.id,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      const { data: dup } = await supabase
        .from('product_categories')
        .select('name')
        .eq('parent_id', madre.id)
        .ilike('name', nombreFinal)
        .maybeSingle();
      if (dup?.name) return normalizarNombreCategoria(String(dup.name));
      throw new Error(`Ya existe «${nombreFinal}» como categoría o dentro de otra categoría. Usa otro nombre.`);
    }
    throw new Error('No se pudo guardar la subcategoría. Revisa la conexión e intenta de nuevo.');
  }
  return nombreFinal;
}
