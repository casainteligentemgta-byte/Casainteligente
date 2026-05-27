import type { SupabaseClient } from '@supabase/supabase-js';
import { apuVacio, calcularApuLuloWin } from '@/lib/proyectos/calcularApuLuloWin';
import type {
  LuloWebErpCapitulo,
  LuloWebErpApuPartida,
  LuloWebErpConfig,
  LuloWebErpPartida,
} from '@/types/lulo-web-erp';

const PAGE = 1000;

/** Normaliza código Lulo (mayúsculas, sin asterisco inicial). */
export function normalizarCodigoLulo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/^\*+/, '');
}

/** Variantes para cruzar ObraPart / catálogo / cascada. */
export function variantesCodigoLulo(codigo: string): string[] {
  const t = codigo.trim();
  const up = t.toUpperCase();
  const sinAst = up.replace(/^\*+/, '');
  const out = new Set<string>();
  if (t) out.add(t);
  if (up) out.add(up);
  if (sinAst) {
    out.add(sinAst);
    out.add(`*${sinAst}`);
  }
  return Array.from(out);
}

export function apuPartidaVacio(apu: LuloWebErpApuPartida | undefined): boolean {
  if (!apu) return true;
  return (
    apu.materiales.length === 0 &&
    apu.equipos.length === 0 &&
    apu.manoObra.length === 0
  );
}

/** Cantidad/rendimiento por línea APU: 0 en BD anula el costo al calcular P.U. */
export function cantidadRendimientoApuLinea(val: unknown): number {
  const n = Number(val ?? 0);
  return n > 0 ? n : 1;
}

export function contarLineasApu(apu: LuloWebErpApuPartida): number {
  return apu.materiales.length + apu.equipos.length + apu.manoObra.length;
}

export async function fetchApuItemsCascada(
  supabase: SupabaseClient,
  partidaIds: string[],
  batchSize = 40,
): Promise<
  Array<{
    partida_id: string;
    tipo: string;
    codigo_insumo: string;
    descripcion: string;
    unidad: string;
    rendimiento: number;
    costo_unitario: number;
  }>
> {
  const all: Array<{
    partida_id: string;
    tipo: string;
    codigo_insumo: string;
    descripcion: string;
    unidad: string;
    rendimiento: number;
    costo_unitario: number;
  }> = [];

  for (let i = 0; i < partidaIds.length; i += batchSize) {
    const batch = partidaIds.slice(i, i + batchSize);
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('apu_items')
        .select(
          'partida_id, tipo, codigo_insumo, descripcion, unidad, rendimiento, costo_unitario',
        )
        .in('partida_id', batch)
        .order('partida_id')
        .order('codigo_insumo')
        .range(from, from + PAGE - 1);
      if (error?.code === '42P01') return all;
      if (error) throw error;
      if (data?.length) all.push(...data);
      if (!data?.length || data.length < PAGE) break;
      from += PAGE;
    }
  }
  return all;
}

async function buildIndiceCatalogoPartidaIds(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('lulo_catalogo_partidas')
      .select('id, codigo_lulo')
      .order('codigo_lulo')
      .range(from, from + PAGE - 1);
    if (error?.code === '42P01') return index;
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const catId = String(row.id);
      const cod = String(row.codigo_lulo ?? '').trim();
      if (!cod) continue;
      for (const v of variantesCodigoLulo(cod)) {
        index.set(normalizarCodigoLulo(v), catId);
        index.set(v.trim().toUpperCase(), catId);
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return index;
}

function resolverCatalogoPartidaId(
  codigoObra: string,
  indice: Map<string, string>,
): string | null {
  for (const v of variantesCodigoLulo(codigoObra)) {
    const hit = indice.get(normalizarCodigoLulo(v)) ?? indice.get(v.trim().toUpperCase());
    if (hit) return hit;
  }
  return null;
}

type InsumoCatalogoRow = {
  codigo: string;
  descripcion: string;
  unidad: string;
  tipo: string | null;
  precio_unitario?: number;
  bono_diario?: number;
};

type LineaCatalogoRow = {
  partida_id: string;
  cantidad_diseno: number;
  es_auto_porcentaje?: boolean;
  insumo: InsumoCatalogoRow | InsumoCatalogoRow[] | null;
};

export type PushLineaApuFn = (
  apu: LuloWebErpApuPartida,
  insumo: {
    codigo: string;
    descripcion: string;
    unidad: string;
    tipo: string | null;
    precio_base?: number;
    precio_unitario?: number;
    bono_diario?: number;
  },
  cantidad: number,
  desperdicio: number,
) => void;

function construirApuDesdeLineasCatalogo(
  rows: LineaCatalogoRow[],
  pushLinea: PushLineaApuFn,
  esHerramientaMenor: (descripcion: string, flag?: boolean) => boolean,
): LuloWebErpApuPartida {
  const apu = apuVacio();
  for (const row of rows) {
    const insumoRaw = row.insumo;
    const insumo = (Array.isArray(insumoRaw) ? insumoRaw[0] : insumoRaw) as InsumoCatalogoRow | null;
    if (!insumo) continue;
    const descripcion = String(insumo.descripcion ?? '');
    if (row.es_auto_porcentaje || esHerramientaMenor(descripcion, true)) {
      apu.equipos.push({
        codigo: insumo.codigo,
        descripcion,
        cantidad: 1,
        tarifa: 0,
        esPorcentajeManoObra: true,
      });
      continue;
    }
    pushLinea(
      apu,
      {
        codigo: insumo.codigo,
        descripcion: insumo.descripcion,
        unidad: insumo.unidad,
        tipo: insumo.tipo,
        precio_unitario: insumo.precio_unitario,
        bono_diario: insumo.bono_diario,
      },
      cantidadRendimientoApuLinea(row.cantidad_diseno),
      0,
    );
  }
  return apu;
}

async function cargarLineasCatalogoPorPartidaIds(
  supabase: SupabaseClient,
  catIds: string[],
): Promise<Map<string, LineaCatalogoRow[]>> {
  const lineasByCatId = new Map<string, LineaCatalogoRow[]>();
  if (!catIds.length) return lineasByCatId;

  const uniq = Array.from(new Set(catIds));
  for (let i = 0; i < uniq.length; i += 40) {
    const batch = uniq.slice(i, i + 40);
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('lulo_catalogo_partida_insumos')
        .select(
          'partida_id, cantidad_diseno, es_auto_porcentaje, insumo:lulo_catalogo_insumos(codigo, descripcion, unidad, tipo, precio_unitario, bono_diario)',
        )
        .in('partida_id', batch)
        .range(from, from + PAGE - 1);
      if (error?.code === '42P01') return lineasByCatId;
      if (error) throw error;
      if (data?.length) {
        for (const row of data as LineaCatalogoRow[]) {
          const pid = String(row.partida_id);
          if (!lineasByCatId.has(pid)) lineasByCatId.set(pid, []);
          lineasByCatId.get(pid)!.push(row);
        }
      }
      if (!data?.length || data.length < PAGE) break;
      from += PAGE;
    }
  }
  return lineasByCatId;
}

/** Aplica APU de catálogo maestro (ObraPain*) cuando cascada/BD está vacío o incompleto. */
export async function aplicarApuDesdeCatalogo(
  supabase: SupabaseClient,
  partidas: Array<{ id: string; codigo: string }>,
  apuByPartidaId: Record<string, LuloWebErpApuPartida>,
  pushLinea: PushLineaApuFn,
  esHerramientaMenor: (descripcion: string, flag?: boolean) => boolean,
): Promise<number> {
  const indice = await buildIndiceCatalogoPartidaIds(supabase);
  if (!indice.size) return 0;

  const catIdPorObraPartida = new Map<string, string>();
  const catIdsNeeded = new Set<string>();

  for (const p of partidas) {
    const catId = resolverCatalogoPartidaId(p.codigo, indice);
    if (!catId) continue;
    catIdPorObraPartida.set(p.id, catId);
    catIdsNeeded.add(catId);
  }

  const lineasByCatId = await cargarLineasCatalogoPorPartidaIds(
    supabase,
    Array.from(catIdsNeeded),
  );

  let aplicadas = 0;
  for (const p of partidas) {
    const catId = catIdPorObraPartida.get(p.id);
    if (!catId) continue;
    const rows = lineasByCatId.get(catId);
    if (!rows?.length) continue;

    const desdeCatalogo = construirApuDesdeLineasCatalogo(rows, pushLinea, esHerramientaMenor);
    if (apuPartidaVacio(desdeCatalogo)) continue;

    const actual = apuByPartidaId[p.id] ?? apuVacio();
    const vacio = apuPartidaVacio(actual);
    const catalogoTieneMas = contarLineasApu(desdeCatalogo) > contarLineasApu(actual);

    if (vacio || catalogoTieneMas) {
      apuByPartidaId[p.id] = desdeCatalogo;
      aplicadas += 1;
    }
  }
  return aplicadas;
}

/** Respaldo: APU guardado en ci_presupuesto_partida_apu por código de partida. */
export async function fusionarApuDesdeCiPresupuestoPorCodigo(
  supabase: SupabaseClient,
  proyectoId: string,
  partidas: Array<{ id: string; codigo: string }>,
  apuByPartidaId: Record<string, LuloWebErpApuPartida>,
  pushLinea: PushLineaApuFn,
  esHerramientaMenor: (descripcion: string, flag?: boolean) => boolean,
): Promise<number> {
  const codigosBusqueda = new Set<string>();
  for (const p of partidas) {
    for (const v of variantesCodigoLulo(p.codigo)) codigosBusqueda.add(v.trim().toUpperCase());
  }
  const codigos = Array.from(codigosBusqueda).filter(Boolean);
  if (!codigos.length) return 0;

  const { data: ciPartidas, error: pErr } = await supabase
    .from('ci_presupuesto_partidas')
    .select('id, codigo_partida')
    .eq('proyecto_id', proyectoId)
    .in('codigo_partida', codigos);
  if (pErr?.code === '42P01') return 0;
  if (pErr) throw pErr;
  if (!ciPartidas?.length) return 0;

  const ciIdByCodigo = new Map<string, string>();
  for (const row of ciPartidas) {
    const cod = String(row.codigo_partida ?? '').trim();
    if (!cod) continue;
    for (const v of variantesCodigoLulo(cod)) {
      ciIdByCodigo.set(normalizarCodigoLulo(v), String(row.id));
      ciIdByCodigo.set(v.trim().toUpperCase(), String(row.id));
    }
  }

  const ciIds = Array.from(new Set(ciPartidas.map((r) => String(r.id))));
  const apuRows: Array<{
    partida_id: string;
    cantidad_rendimiento: number;
    desperdicio_porcentaje: number;
    insumo: {
      codigo: string;
      descripcion: string;
      unidad: string;
      precio_base?: number;
      tipo: string | null;
    } | null;
  }> = [];

  for (let i = 0; i < ciIds.length; i += 80) {
    const { data, error: aErr } = await supabase
      .from('ci_presupuesto_partida_apu')
      .select(
        'partida_id, cantidad_rendimiento, desperdicio_porcentaje, insumo:ci_lulo_insumos_maestro(codigo, descripcion, unidad, precio_base, tipo)',
      )
      .in('partida_id', ciIds.slice(i, i + 80));
    if (aErr?.code === '42P01') return 0;
    if (aErr) throw aErr;
    if (data?.length) apuRows.push(...(data as unknown as typeof apuRows));
  }

  const apuPorCiPartidaId = new Map<string, typeof apuRows>();
  for (const row of apuRows) {
    const pid = String(row.partida_id);
    if (!apuPorCiPartidaId.has(pid)) apuPorCiPartidaId.set(pid, []);
    apuPorCiPartidaId.get(pid)!.push(row);
  }

  let fusionadas = 0;
  for (const p of partidas) {
    if (!apuPartidaVacio(apuByPartidaId[p.id])) continue;
    const ciPid = resolverCatalogoPartidaId(p.codigo, ciIdByCodigo);
    if (!ciPid) continue;
    const rows = apuPorCiPartidaId.get(ciPid);
    if (!rows?.length) continue;

    const apu = apuVacio();
    for (const row of rows) {
      const insumoRaw = row.insumo;
      const insumo = (Array.isArray(insumoRaw) ? insumoRaw[0] : insumoRaw) as {
        codigo: string;
        descripcion: string;
        unidad: string;
        precio_base?: number;
        tipo: string | null;
      } | null;
      if (!insumo) continue;
      pushLinea(
        apu,
        { ...insumo, precio_unitario: insumo.precio_base },
        cantidadRendimientoApuLinea(row.cantidad_rendimiento),
        Number(row.desperdicio_porcentaje ?? 0),
      );
    }
    if (!apuPartidaVacio(apu)) {
      apuByPartidaId[p.id] = apu;
      fusionadas += 1;
    }
  }
  return fusionadas;
}

/** Catálogo + ci_presupuesto para todas las partidas de la vista APU. */
export async function completarApuPartidasObra(
  supabase: SupabaseClient,
  proyectoId: string,
  partidas: Array<{ id: string; codigo: string }>,
  apuByPartidaId: Record<string, LuloWebErpApuPartida>,
  pushLinea: PushLineaApuFn,
  esHerramientaMenor: (descripcion: string, flag?: boolean) => boolean,
): Promise<void> {
  await aplicarApuDesdeCatalogo(supabase, partidas, apuByPartidaId, pushLinea, esHerramientaMenor);
  await fusionarApuDesdeCiPresupuestoPorCodigo(
    supabase,
    proyectoId,
    partidas,
    apuByPartidaId,
    pushLinea,
    esHerramientaMenor,
  );
}

/** Descripciones del catálogo maestro Lulo por código de partida. */
export async function cargarDescripcionesCatalogoPorCodigo(
  supabase: SupabaseClient,
  codigos: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = new Set<string>();
  for (const c of codigos) {
    for (const v of variantesCodigoLulo(c)) uniq.add(v.trim().toUpperCase());
  }
  const lista = Array.from(uniq).filter(Boolean);
  for (let i = 0; i < lista.length; i += 80) {
    const batch = lista.slice(i, i + 80);
    const { data, error } = await supabase
      .from('lulo_catalogo_partidas')
      .select('codigo_lulo, descripcion')
      .in('codigo_lulo', batch);
    if (error?.code === '42P01') return map;
    for (const row of data ?? []) {
      const cod = String(row.codigo_lulo ?? '').trim();
      const des = String(row.descripcion ?? '').trim();
      if (!cod || !des || des.toUpperCase() === cod.toUpperCase()) continue;
      for (const v of variantesCodigoLulo(cod)) {
        map.set(normalizarCodigoLulo(v), des);
        map.set(v.trim().toUpperCase(), des);
      }
    }
  }
  return map;
}

/** Si falta P.U. en BD, calcula desde composición APU (márgenes LuloWin). */
export function completarPrecioUnitarioPartidas(
  partidasByCapitulo: Record<string, LuloWebErpPartida[]>,
  apuByPartidaId: Record<string, LuloWebErpApuPartida>,
  config: LuloWebErpConfig,
): void {
  for (const list of Object.values(partidasByCapitulo)) {
    for (const p of list) {
      if (Number(p.precioUnitario) > 0) continue;
      const apu = apuByPartidaId[p.id];
      if (!apu || apuPartidaVacio(apu)) continue;
      p.precioUnitario = calcularApuLuloWin(apu, p.rendimiento, config).precioUnitarioFinal;
    }
  }
}

/** Si falta monto en BD, usa cantidad × P.U. (ya completado). */
export function completarMontoTotalPartidas(
  partidasByCapitulo: Record<string, LuloWebErpPartida[]>,
): void {
  for (const list of Object.values(partidasByCapitulo)) {
    for (const p of list) {
      if (Number(p.montoTotal) > 0) continue;
      const cant = Number(p.cantidad) || 0;
      const pu = Number(p.precioUnitario) || 0;
      if (cant > 0 && pu > 0) {
        p.montoTotal = Math.round(cant * pu * 100) / 100;
      }
    }
  }
}

export function resolverDescripcionPartida(
  codigo: string,
  descripcionActual: string,
  mapa: Map<string, string>,
): string {
  const cod = codigo.trim();
  const des = descripcionActual.trim();
  if (des && des.toUpperCase() !== cod.toUpperCase()) return des;
  return (
    mapa.get(cod.toUpperCase()) ??
    mapa.get(normalizarCodigoLulo(cod)) ??
    (des || cod)
  );
}

export async function cargarRendimientoCatalogoPorCodigo(
  supabase: SupabaseClient,
  codigos: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const uniq = new Set<string>();
  for (const c of codigos) {
    for (const v of variantesCodigoLulo(c)) uniq.add(v.trim().toUpperCase());
  }
  const lista = Array.from(uniq).filter(Boolean);
  for (let i = 0; i < lista.length; i += 80) {
    const batch = lista.slice(i, i + 80);
    const { data } = await supabase
      .from('lulo_catalogo_partidas')
      .select('codigo_lulo, rendimiento')
      .in('codigo_lulo', batch);
    for (const row of data ?? []) {
      const cod = String(row.codigo_lulo ?? '').trim();
      const ren = Number(row.rendimiento ?? 0);
      if (!cod || ren <= 0) continue;
      for (const v of variantesCodigoLulo(cod)) {
        map.set(normalizarCodigoLulo(v), ren);
        map.set(v.trim().toUpperCase(), ren);
      }
    }
  }
  return map;
}

/** Número de capítulo desde código persistido ("1", "01", "Cap. 3"). */
export function numCapDesdeCodigo(codigo: string, fallback = 0): number {
  const t = String(codigo ?? '').trim();
  const m = t.match(/\d+/);
  if (!m) return fallback;
  const n = Number.parseInt(m[0], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Quita prefijo "Capítulo", "Capitulo", "Capìtulo", etc. */
export function stripEtiquetaCapitulo(nombre: string): string {
  return String(nombre ?? '')
    .trim()
    .replace(/^cap[iííì]tulo\s*[-.:]?\s*/i, '')
    .trim();
}

/** Código de capítulo válido en cascada ObraCapi (1, 01, 2…). */
export function esCodigoCapituloObra(codigo: string): boolean {
  const t = String(codigo ?? '').trim();
  return /^\d{1,3}$/.test(t) && Number.parseInt(t, 10) > 0;
}

/** Nombre parece código de partida Lulo, no título de capítulo ObraCapi. */
export function esPseudoCapituloPartida(nombre: string, numCap?: number): boolean {
  const raw = String(nombre ?? '').trim();
  const n = stripEtiquetaCapitulo(raw);
  if (!n) return true;
  if (numCap != null && numCap > 0 && numCap < 9999 && (n === String(numCap) || raw === String(numCap))) {
    return false;
  }
  if (n.length >= 20 && /\s/.test(n)) return false;
  // Títulos ObraCapi de una palabra (ESTRUCTURA, PISCINA, ALBAÑILERIA…)
  if (!/\d/.test(n) && !n.startsWith('*') && /^[A-ZÁÉÍÓÚÑ]+$/i.test(n) && n.length >= 6) {
    return false;
  }
  if (/^\*/.test(n)) return true;
  if (/[A-Z]\d|\d[A-Z]/i.test(n) && !/\s/.test(n)) return true;
  if (/^[\*]?[A-Z]{2,8}\d{1,8}$/i.test(n)) return true;
  if (/^[\*]?[A-Z0-9\-]{2,16}$/i.test(n) && !/\s/.test(n) && n.length <= 14) return true;
  if (/^P\d{4,}/i.test(n)) return true;
  return false;
}

/**
 * Ordena capítulos por NumCap, excluye pseudo-capítulos (códigos de partida)
 * y deja solo entradas con partidas.
 */
export function finalizarCapitulosSidebar(
  capitulos: LuloWebErpCapitulo[],
  partidasByCapitulo: Record<string, LuloWebErpPartida[]>,
  opts?: { incluirVacios?: boolean; soloCodigoObra?: boolean },
): LuloWebErpCapitulo[] {
  const conPartidas = capitulos.filter(
    (c) => (partidasByCapitulo[c.id]?.length ?? 0) > 0 || opts?.incluirVacios,
  );

  const lista = conPartidas.filter((c) => {
    if (esPseudoCapituloPartida(c.nombre, c.numCap)) return false;
    if (opts?.soloCodigoObra) {
      const cod = String(c.codigo ?? c.numCap).trim();
      return (
        esCodigoCapituloObra(cod) ||
        esCodigoCapituloObra(String(c.numCap)) ||
        (c.nombre.length >= 12 && /\s/.test(c.nombre)) ||
        (c.nombre.length >= 6 && !/\d/.test(c.nombre) && !c.nombre.startsWith('*'))
      );
    }
    return true;
  });

  return [...lista].sort((a, b) => {
    if (a.numCap !== b.numCap) return a.numCap - b.numCap;
    return a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/** Cascada obra: filtro estricto ObraCapi y, si queda vacío, relajado (evita sidebar en blanco). */
export function resolverCapitulosSidebarObra(
  capitulos: LuloWebErpCapitulo[],
  partidasByCapitulo: Record<string, LuloWebErpPartida[]>,
): LuloWebErpCapitulo[] {
  const estricto = finalizarCapitulosSidebar(capitulos, partidasByCapitulo, {
    soloCodigoObra: true,
  });
  if (estricto.length) return estricto;

  const relajado = finalizarCapitulosSidebar(capitulos, partidasByCapitulo);
  if (relajado.length) return relajado;

  return [...capitulos]
    .filter((c) => (partidasByCapitulo[c.id]?.length ?? 0) > 0)
    .sort((a, b) => {
      if (a.numCap !== b.numCap) return a.numCap - b.numCap;
      return a.nombre.localeCompare(b.nombre, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
}

/** @deprecated Usar aplicarApuDesdeCatalogo */
export async function enriquecerApuVaciosDesdeCatalogo(
  supabase: SupabaseClient,
  partidas: Array<{ id: string; codigo: string }>,
  apuByPartidaId: Record<string, LuloWebErpApuPartida>,
  pushLinea: PushLineaApuFn,
  esHerramientaMenor: (descripcion: string, flag?: boolean) => boolean,
): Promise<number> {
  return aplicarApuDesdeCatalogo(
    supabase,
    partidas,
    apuByPartidaId,
    pushLinea,
    esHerramientaMenor,
  );
}
