import type { SupabaseClient } from '@supabase/supabase-js';
import { apuVacio } from '@/lib/proyectos/calcularApuLuloWin';
import type { LuloWebErpApuPartida } from '@/types/lulo-web-erp';

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
      Number(row.cantidad_diseno ?? 0),
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
        Number(row.cantidad_rendimiento ?? 0),
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
