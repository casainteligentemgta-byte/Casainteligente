import { normalizeLuloRow, pickField, pickNumber } from '@/lib/proyectos/luloFieldMapping';
import { compareCodigoNatural, getCapituloKey } from '@/lib/proyectos/luloVistaAgrupada';
import {
  findLuloTable,
  LULO_PARTIDA_COLS,
  resolveLuloColumn,
} from '@/lib/proyectos/luloTablasNativas';

const OBRACAPIDESC_COD = ['cod_cap', 'codcap', 'codigo_capitulo', 'cap'] as const;
const OBRACAPIDESC_DES = ['des_cap', 'descap', 'descripcion', 'nombre'] as const;
import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';
import type { LuloMdbFullDump, LuloMdbTableDump } from '@/lib/proyectos/extractLuloFull';
import {
  buildEnlacesCapituloPartida,
  codCapDesdePrefijoPartida,
  numParDesdeFila,
} from '@/lib/proyectos/luloCapituloEnlaces';
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
  /** Código en cascada (típ. CodCap / NumCap: "1"…"9"). */
  codigo: string;
  descripcion: string;
  orden: number;
  /** CodCap interno Lulo (enlace ObraCapiPart → ObraCapi). */
  codCapLulo?: string;
  /** Rango NumPar en ObraApun (ObraCapi.ParDes … ParHas). */
  parDes?: number;
  parHas?: number;
};

export type GrupoCapituloFilas = {
  capitulo: LuloCapituloDef;
  partidas: Record<string, unknown>[];
};

function cell(row: Record<string, string>, col: string | null): string {
  if (!col) return '';
  return row[normalizeColumnKey(col)] ?? '';
}

/** Descripciones largas LuloWin (ObraCapiDesc), indexadas por CodCap y filtradas por obra. */
function mapDescripcionObraCapiDesc(
  dump: LuloMdbFullDump,
  codigoObra?: string,
): Map<string, string> {
  const m = new Map<string, string>();
  const t = dump.tables.find((x) => x.name.trim().toUpperCase() === 'OBRACAPIDESC');
  if (!t?.rows.length) return m;
  const filtro = codigoObra?.trim().toUpperCase();
  const cCod = resolveLuloColumn(t.columns, OBRACAPIDESC_COD);
  const cDes = resolveLuloColumn(t.columns, OBRACAPIDESC_DES);
  const cObr = resolveLuloColumn(t.columns, LULO_PARTIDA_COLS.codigoObra);
  for (const raw of t.rows) {
    const row = normalizeLuloRow(raw);
    if (filtro && cObr) {
      const obr =
        cell(row, cObr) || pickField(row, [...LULO_PARTIDA_COLS.codigoObra]);
      if (obr.trim().toUpperCase() !== filtro) continue;
    }
    const cod =
      cell(row, cCod) || pickField(row, [...OBRACAPIDESC_COD]);
    const des =
      cell(row, cDes) || pickField(row, [...OBRACAPIDESC_DES]);
    const k = cod.trim().toUpperCase();
    if (!k || !des.trim()) continue;
    if (!m.has(k)) m.set(k, des.trim());
  }
  return m;
}

const OBRACAPI_PAR_DES = ['pardes', 'par_des'] as const;
const OBRACAPI_PAR_HAS = ['parhas', 'par_has'] as const;
function tablaEsObraCapi(table: LuloMdbTableDump): boolean {
  return table.name.trim().toUpperCase() === 'OBRACAPI';
}

export function resolverCapituloPorNumPar(
  capitulos: LuloCapituloDef[],
  numPar: number,
): LuloCapituloDef | undefined {
  if (!Number.isFinite(numPar) || numPar <= 0) return undefined;
  for (const c of capitulos) {
    const desde = c.parDes;
    const hasta = c.parHas;
    if (desde != null && hasta != null && numPar >= desde && numPar <= hasta) {
      return c;
    }
  }
  return undefined;
}

export type ParseCapitulosDesdeDumpOpts = {
  /** Filtra filas de capítulo por obra (p. ej. ObraCapi.CodObr). */
  codigoObra?: string;
};

/** Lee tabla CAPITULOS del volcado MDB (si existe). */
export function parseCapitulosDesdeDump(
  dump: LuloMdbFullDump,
  opts?: ParseCapitulosDesdeDumpOpts,
): LuloCapituloDef[] {
  const table = findLuloTableCapitulos(dump);
  if (!table) return [];

  const cCod = resolveLuloColumn(table.columns, LULO_CAPITULO_COLS.codigo);
  const cDes = resolveLuloColumn(table.columns, LULO_CAPITULO_COLS.descripcion);
  const cOrd = resolveLuloColumn(table.columns, LULO_CAPITULO_COLS.orden);
  const cObr = resolveLuloColumn(table.columns, LULO_PARTIDA_COLS.codigoObra);
  const filtroObra = opts?.codigoObra?.trim().toUpperCase();
  const descExtendida = mapDescripcionObraCapiDesc(dump, opts?.codigoObra);
  const esObraCapi = tablaEsObraCapi(table);
  const cParDes = esObraCapi ? resolveLuloColumn(table.columns, OBRACAPI_PAR_DES) : null;
  const cParHas = esObraCapi ? resolveLuloColumn(table.columns, OBRACAPI_PAR_HAS) : null;

  const out: LuloCapituloDef[] = [];
  const seenOrden = new Set<number>();
  let autoOrden = 0;

  for (const raw of table.rows) {
    const row = normalizeLuloRow(raw);
    if (filtroObra && cObr) {
      const codObr =
        cell(row, cObr) || pickField(row, [...LULO_PARTIDA_COLS.codigoObra]);
      if (codObr.trim().toUpperCase() !== filtroObra) continue;
    }

    const codCapLulo =
      (cell(row, cCod) || pickField(row, [...LULO_CAPITULO_COLS.codigo])).trim();
    let numCap = 0;
    if (esObraCapi && codCapLulo) {
      numCap = Math.floor(Number(codCapLulo)) || 0;
    }
    if (numCap <= 0) {
      const ordenRaw = cOrd
        ? pickNumber(row, [cOrd])
        : pickNumber(row, [...LULO_CAPITULO_COLS.orden]);
      numCap = ordenRaw > 0 ? Math.floor(ordenRaw) : ++autoOrden;
    }
    if (numCap <= 0 || seenOrden.has(numCap)) continue;
    seenOrden.add(numCap);

    const desBase =
      cell(row, cDes) || pickField(row, [...LULO_CAPITULO_COLS.descripcion]) || '';
    const desLarga = codCapLulo ? (descExtendida.get(codCapLulo.toUpperCase()) ?? '') : '';
    const descripcion = (
      desBase.trim() ||
      desLarga.trim() ||
      (codCapLulo ? `Capítulo ${codCapLulo}` : `Capítulo ${numCap}`)
    )
      .trim()
      .slice(0, 500);

    const parDes = cParDes ? Math.floor(pickNumber(row, [cParDes])) : 0;
    const parHas = cParHas ? Math.floor(pickNumber(row, [cParHas])) : 0;

    out.push({
      codigo: String(numCap),
      descripcion,
      orden: numCap,
      codCapLulo: codCapLulo || undefined,
      parDes: parDes > 0 ? parDes : undefined,
      parHas: parHas > 0 ? parHas : undefined,
    });
  }

  return out.sort((a, b) => a.orden - b.orden || compareCodigoNatural(a.codigo, b.codigo));
}

function findLuloTableCapitulos(dump: LuloMdbFullDump): LuloMdbTableDump | null {
  const obraCapi = dump.tables.find(
    (t) => t.name.trim().toUpperCase() === 'OBRACAPI' && t.rows.length > 0,
  );
  if (obraCapi) return obraCapi;

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
    const cod = c.codigo.trim().toUpperCase();
    m.set(cod, c);
    if (c.orden > 0) {
      m.set(String(c.orden), c);
      m.set(String(c.orden).padStart(2, '0'), c);
    }
    const capLulo = c.codCapLulo?.trim().toUpperCase();
    if (capLulo) m.set(capLulo, c);
  }
  return m;
}

function resolverCapituloEnMapa(
  mapa: Map<string, LuloCapituloDef>,
  codigoCandidato: string,
): LuloCapituloDef | undefined {
  const key = codigoCandidato.trim().toUpperCase();
  if (!key) return undefined;
  return mapa.get(key);
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
  const hit = resolverCapituloEnMapa(mapa, codCap);
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
  opts?: ParseCapitulosDesdeDumpOpts,
): PartidaLuloInsert[] {
  const capitulos = parseCapitulosDesdeDump(dump, opts);
  const mapa = mapaCapitulos(capitulos);
  const enlaces = buildEnlacesCapituloPartida(dump, { codigoObra: opts?.codigoObra });
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
    const key = p.codigo_partida.trim().toUpperCase();
    const raw = filaPorCodigo.get(key);
    const cap = raw
      ? resolverCapituloPartida(raw, tabla.columns, mapa, p.codigo_partida)
      : resolverCapituloPartida({}, [], mapa, p.codigo_partida);

    let capFinal = cap;
    const codCapEnlace = enlaces.codCap.get(key);
    if (codCapEnlace) {
      const hitCap = resolverCapituloEnMapa(mapa, codCapEnlace);
      if (hitCap) {
        capFinal = {
          capitulo_codigo: hitCap.codigo,
          capitulo_descripcion: hitCap.descripcion,
          capitulo_orden: hitCap.orden,
        };
      }
    } else if (raw && capitulos.some((c) => c.parDes != null)) {
      const numPar = numParDesdeFila(raw, tabla.columns);
      const hitRango = resolverCapituloPorNumPar(capitulos, numPar);
      if (hitRango) {
        capFinal = {
          capitulo_codigo: hitRango.codigo,
          capitulo_descripcion: hitRango.descripcion,
          capitulo_orden: hitRango.orden,
        };
      }
    }

    if (capFinal.capitulo_orden === 9999) {
      const hitPref = resolverCapituloEnMapa(mapa, codCapDesdePrefijoPartida(p.codigo_partida));
      if (hitPref) {
        capFinal = {
          capitulo_codigo: hitPref.codigo,
          capitulo_descripcion: hitPref.descripcion,
          capitulo_orden: hitPref.orden,
        };
      }
    }

    const canCapi = enlaces.canPar.get(key);
    const cantidad =
      Number(p.cantidad_presupuestada) > 0
        ? Number(p.cantidad_presupuestada)
        : canCapi != null && canCapi > 0
          ? canCapi
          : Number(p.cantidad_presupuestada);

    return { ...p, ...capFinal, cantidad_presupuestada: cantidad };
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
  opts?: ParseCapitulosDesdeDumpOpts,
): GrupoCapituloFilas[] {
  const capitulos = parseCapitulosDesdeDump(dump, opts);
  const mapa = mapaCapitulos(capitulos);
  const enlaces = buildEnlacesCapituloPartida(dump, { codigoObra: opts?.codigoObra });
  const cCod = resolveLuloColumn(tablaPartidas.columns, LULO_PARTIDA_COLS.codigo);
  const cCap = resolveLuloColumn(tablaPartidas.columns, LULO_PARTIDA_CAP_COLS.codigoCapitulo);
  const buckets = new Map<string, Record<string, unknown>[]>();
  const meta = new Map<string, LuloCapituloDef>();
  const sinCapKey = '__sin_cap__';

  if (capitulos.length > 0) {
    for (const cap of capitulos) {
      buckets.set(cap.codigo.trim().toUpperCase(), []);
      meta.set(cap.codigo.trim().toUpperCase(), cap);
    }
    buckets.set(sinCapKey, []);
  }

  for (const raw of tablaPartidas.rows) {
    const row = normalizeLuloRow(raw);
    const codPar =
      (cCod ? String((raw as Record<string, unknown>)[cCod] ?? '').trim() : '') ||
      pickField(row, [...LULO_PARTIDA_COLS.codigo]) ||
      '—';
    const codParKey = codPar.trim().toUpperCase();

    let codCap = enlaces.codCap.get(codParKey) || '';
    if (!codCap) {
      codCap =
        (cCap ? String((raw as Record<string, unknown>)[cCap] ?? '').trim() : '') ||
        pickField(row, [...LULO_PARTIDA_CAP_COLS.codigoCapitulo]);
    }
    if (!codCap && capitulos.some((c) => c.parDes != null)) {
      const numPar = numParDesdeFila(raw as Record<string, unknown>, tablaPartidas.columns);
      const hitRango = resolverCapituloPorNumPar(capitulos, numPar);
      if (hitRango) codCap = hitRango.codigo;
    }
    if (!codCap) codCap = getCapituloKey(codPar);

    const hit = resolverCapituloEnMapa(mapa, codCap);
    const bucketKey = hit
      ? hit.codigo.trim().toUpperCase()
      : capitulos.length > 0
        ? sinCapKey
        : codCap.trim().toUpperCase();

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
      if (!hit) {
        meta.set(bucketKey, {
          codigo: codCap,
          descripcion: `Capítulo ${codCap}`,
          orden: 9000 + meta.size,
        });
      }
    }
    buckets.get(bucketKey)!.push(raw as Record<string, unknown>);
  }

  const ordenCapitulos =
    capitulos.length > 0
      ? [...capitulos].sort((a, b) => a.orden - b.orden)
      : Array.from(meta.values()).sort(
          (a, b) => a.orden - b.orden || compareCodigoNatural(a.codigo, b.codigo),
        );

  const grupos = ordenCapitulos.map((cap) => ({
    capitulo: cap,
    partidas: ordenarFilasPorCodigoPartida(
      buckets.get(cap.codigo.trim().toUpperCase()) ?? [],
      cCod,
    ),
  }));

  const sinFilas = buckets.get(sinCapKey);
  if (sinFilas?.length) {
    grupos.push({
      capitulo: { codigo: '0', descripcion: 'Sin capítulo', orden: 9999 },
      partidas: ordenarFilasPorCodigoPartida(sinFilas, cCod),
    });
  }

  return grupos.filter((g) => g.partidas.length > 0);
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
