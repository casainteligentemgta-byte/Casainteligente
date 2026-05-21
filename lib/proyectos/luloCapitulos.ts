import { normalizeLuloRow, pickField, pickNumber } from '@/lib/proyectos/luloFieldMapping';
import { compareCodigoNatural, getCapituloKey } from '@/lib/proyectos/luloVistaAgrupada';
import {
  findLuloTable,
  LULO_PARTIDA_COLS,
  resolveLuloColumn,
} from '@/lib/proyectos/luloTablasNativas';
import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';
import type { LuloMdbFullDump, LuloMdbTableDump } from '@/lib/proyectos/extractLuloFull';
import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';

export const LULO_CAPITULO_COLS = {
  codigo: ['cod_cap', 'codigo_capitulo', 'codigo', 'capitulo', 'cod_capitulo', 'cap'],
  descripcion: ['des_cap', 'descripcion', 'nombre', 'titulo'],
  orden: ['orden', 'num_cap', 'secuencia', 'nro', 'numero', 'ord'],
} as const;

export const LULO_PARTIDA_CAP_COLS = {
  codigoCapitulo: ['cod_cap', 'codigo_capitulo', 'capitulo', 'cod_capitulo', 'cap'],
} as const;

export type LuloCapituloDef = {
  codigo: string;
  descripcion: string;
  orden: number;
};

export type GrupoCapituloFilas = {
  capitulo: LuloCapituloDef;
  partidas: Record<string, unknown>[];
};

function cell(row: Record<string, string>, col: string | null): string {
  if (!col) return '';
  return row[normalizeColumnKey(col)] ?? '';
}

/** Lee tabla CAPITULOS del volcado MDB (si existe). */
export function parseCapitulosDesdeDump(dump: LuloMdbFullDump): LuloCapituloDef[] {
  const table = findLuloTableCapitulos(dump);
  if (!table) return [];

  const cCod = resolveLuloColumn(table.columns, LULO_CAPITULO_COLS.codigo);
  const cDes = resolveLuloColumn(table.columns, LULO_CAPITULO_COLS.descripcion);
  const cOrd = resolveLuloColumn(table.columns, LULO_CAPITULO_COLS.orden);

  const out: LuloCapituloDef[] = [];
  const seen = new Set<string>();
  let autoOrden = 0;

  for (const raw of table.rows) {
    const row = normalizeLuloRow(raw);
    const codigo =
      cell(row, cCod) || pickField(row, [...LULO_CAPITULO_COLS.codigo]);
    if (!codigo.trim()) continue;
    const key = codigo.trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    autoOrden += 1;
    const ordenRaw = cOrd ? pickNumber(row, [cOrd]) : pickNumber(row, [...LULO_CAPITULO_COLS.orden]);
    const descripcion =
      cell(row, cDes) || pickField(row, [...LULO_CAPITULO_COLS.descripcion]) || codigo.trim();

    out.push({
      codigo: codigo.trim(),
      descripcion: descripcion.trim().slice(0, 500),
      orden: ordenRaw > 0 ? Math.floor(ordenRaw) : autoOrden,
    });
  }

  return out.sort((a, b) => a.orden - b.orden || compareCodigoNatural(a.codigo, b.codigo));
}

function findLuloTableCapitulos(dump: LuloMdbFullDump): LuloMdbTableDump | null {
  const exact = dump.tables.find(
    (t) => t.name.trim().toUpperCase() === 'CAPITULOS' && t.rows.length > 0,
  );
  if (exact) return exact;

  let best: LuloMdbTableDump | null = null;
  for (const t of dump.tables) {
    if (t.name.startsWith('MSys') || t.rows.length === 0) continue;
    const n = t.name.trim().toLowerCase();
    if (n === 'capitulos' || /^capitulo/.test(n) || /capitulos?obra/.test(n)) {
      if (!best || t.rows.length > best.rows.length) best = t;
    }
  }
  return best;
}

export function mapaCapitulos(capitulos: LuloCapituloDef[]): Map<string, LuloCapituloDef> {
  const m = new Map<string, LuloCapituloDef>();
  for (const c of capitulos) {
    m.set(c.codigo.trim().toUpperCase(), c);
  }
  return m;
}

/** Resuelve capítulo de una fila PARTIDAS (Cod_Cap o prefijo del código). */
export function resolverCapituloPartida(
  row: Record<string, unknown>,
  columnNames: string[],
  mapa: Map<string, LuloCapituloDef>,
  codigoPartida: string,
): Pick<PartidaLuloInsert, 'capitulo_codigo' | 'capitulo_descripcion' | 'capitulo_orden'> {
  const r = normalizeLuloRow(row);
  const cCap = resolveLuloColumn(columnNames, LULO_PARTIDA_CAP_COLS.codigoCapitulo);
  let codCap = cell(r, cCap) || pickField(r, [...LULO_PARTIDA_CAP_COLS.codigoCapitulo]);

  if (!codCap) codCap = getCapituloKey(codigoPartida);
  const hit = mapa.get(codCap.trim().toUpperCase());
  if (hit) {
    return {
      capitulo_codigo: hit.codigo,
      capitulo_descripcion: hit.descripcion,
      capitulo_orden: hit.orden,
    };
  }
  return {
    capitulo_codigo: codCap,
    capitulo_descripcion: `Capítulo ${codCap}`,
    capitulo_orden: 9999,
  };
}

export function enriquecerPartidasConCapitulos(
  partidas: PartidaLuloInsert[],
  dump: LuloMdbFullDump,
  partidasTable?: LuloMdbTableDump | null,
): PartidaLuloInsert[] {
  const capitulos = parseCapitulosDesdeDump(dump);
  const mapa = mapaCapitulos(capitulos);
  const tabla = partidasTable ?? findLuloTable(dump, 'partidas');
  if (!tabla) {
    return ordenarPartidasPorCapitulos(
      partidas.map((p) => ({
        ...p,
        capitulo_codigo: getCapituloKey(p.codigo_partida),
        capitulo_descripcion: `Capítulo ${getCapituloKey(p.codigo_partida)}`,
        capitulo_orden: 9999,
      })),
    );
  }

  const filaPorCodigo = new Map<string, Record<string, unknown>>();
  const cCod = resolveLuloColumn(tabla.columns, LULO_PARTIDA_COLS.codigo);
  for (const raw of tabla.rows) {
    const row = normalizeLuloRow(raw);
    const cod =
      (cCod ? String((raw as Record<string, unknown>)[cCod] ?? '').trim() : '') ||
      pickField(row, [...LULO_PARTIDA_COLS.codigo]);
    if (cod) filaPorCodigo.set(cod.trim().toUpperCase(), raw);
  }

  const enriched = partidas.map((p) => {
    const raw = filaPorCodigo.get(p.codigo_partida.trim().toUpperCase());
    const cap = raw
      ? resolverCapituloPartida(raw, tabla.columns, mapa, p.codigo_partida)
      : resolverCapituloPartida({}, [], mapa, p.codigo_partida);
    return { ...p, ...cap };
  });

  return ordenarPartidasPorCapitulos(enriched);
}

export function ordenarPartidasPorCapitulos<
  T extends {
    capitulo_orden?: number | null;
    capitulo_codigo?: string | null;
    codigo_partida: string;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const oa = Number(a.capitulo_orden ?? 9999);
    const ob = Number(b.capitulo_orden ?? 9999);
    if (oa !== ob) return oa - ob;
    const ca = String(a.capitulo_codigo ?? getCapituloKey(a.codigo_partida));
    const cb = String(b.capitulo_codigo ?? getCapituloKey(b.codigo_partida));
    const cmpCap = compareCodigoNatural(ca, cb);
    if (cmpCap !== 0) return cmpCap;
    return compareCodigoNatural(a.codigo_partida, b.codigo_partida);
  });
}

/** Agrupa filas crudas del volcado PARTIDAS por capítulo (para pestaña Volcado Lulo). */
export function agruparFilasMdbPartidasPorCapitulos(
  dump: LuloMdbFullDump,
  tablaPartidas: LuloMdbTableDump,
): GrupoCapituloFilas[] {
  const capitulos = parseCapitulosDesdeDump(dump);
  const mapa = mapaCapitulos(capitulos);
  const cCod = resolveLuloColumn(tablaPartidas.columns, LULO_PARTIDA_COLS.codigo);
  const cCap = resolveLuloColumn(tablaPartidas.columns, LULO_PARTIDA_CAP_COLS.codigoCapitulo);

  const buckets = new Map<string, Record<string, unknown>[]>();
  const meta = new Map<string, LuloCapituloDef>();

  for (const cap of capitulos) {
    buckets.set(cap.codigo.trim().toUpperCase(), []);
    meta.set(cap.codigo.trim().toUpperCase(), cap);
  }

  for (const raw of tablaPartidas.rows) {
    const row = normalizeLuloRow(raw);
    const codPar =
      (cCod ? String((raw as Record<string, unknown>)[cCod] ?? '').trim() : '') ||
      pickField(row, [...LULO_PARTIDA_COLS.codigo]) ||
      '—';
    let codCap =
      (cCap ? String((raw as Record<string, unknown>)[cCap] ?? '').trim() : '') ||
      pickField(row, [...LULO_PARTIDA_CAP_COLS.codigoCapitulo]);
    if (!codCap) codCap = getCapituloKey(codPar);
    const key = codCap.trim().toUpperCase();
    if (!buckets.has(key)) {
      buckets.set(key, []);
      meta.set(key, mapa.get(key) ?? {
        codigo: codCap,
        descripcion: `Capítulo ${codCap}`,
        orden: 9000 + buckets.size,
      });
    }
    buckets.get(key)!.push(raw as Record<string, unknown>);
  }

  const ordenCapitulos = Array.from(meta.values()).sort(
    (a, b) => a.orden - b.orden || compareCodigoNatural(a.codigo, b.codigo),
  );

  return ordenCapitulos
    .map((cap) => ({
      capitulo: cap,
      partidas: ordenarFilasPorCodigoPartida(
        buckets.get(cap.codigo.trim().toUpperCase()) ?? [],
        cCod,
      ),
    }))
    .filter((g) => g.partidas.length > 0);
}

function ordenarFilasPorCodigoPartida(
  filas: Record<string, unknown>[],
  colCod: string | null,
): Record<string, unknown>[] {
  return [...filas].sort((a, b) => {
    const ra = normalizeLuloRow(a);
    const rb = normalizeLuloRow(b);
    const ca =
      (colCod ? String((a as Record<string, unknown>)[colCod] ?? '').trim() : '') ||
      pickField(ra, [...LULO_PARTIDA_COLS.codigo]);
    const cb =
      (colCod ? String((b as Record<string, unknown>)[colCod] ?? '').trim() : '') ||
      pickField(rb, [...LULO_PARTIDA_COLS.codigo]);
    return compareCodigoNatural(ca, cb);
  });
}

export function getCapituloKeyPartida(p: {
  codigo_partida: string;
  capitulo_codigo?: string | null;
}): string {
  const cap = p.capitulo_codigo?.trim();
  if (cap) return cap;
  return getCapituloKey(p.codigo_partida);
}
