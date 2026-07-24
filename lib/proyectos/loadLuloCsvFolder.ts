import fs from 'fs';
import path from 'path';
import { extractFullLuloCsv, type LuloMdbFullDump, type LuloMdbTableDump } from '@/lib/proyectos/extractLuloFull';
import { filasObraCapiPart } from '@/lib/proyectos/luloCapituloEnlaces';
import { normalizeLuloRow } from '@/lib/proyectos/luloFieldMapping';
import { leerValorNumericoFila } from '@/lib/proyectos/lulo/leerValorNumericoFila';
import {
  LULO_COMPOSICION_COLS,
  LULO_PARTIDA_COLS,
  resolveLuloColumn,
} from '@/lib/proyectos/luloTablasNativas';

const INSUMO_SOURCES: {
  table: string;
  codCol: string;
  uniCol?: string;
  preCol: string;
  tipo: string;
  defaultUni: string;
}[] = [
  { table: 'ObraMate', codCol: 'CodMat', uniCol: 'UniMat', preCol: 'CosMat', tipo: 'material', defaultUni: 'UND' },
  { table: 'ObraMano', codCol: 'CodMan', preCol: 'Salari', tipo: 'mano_obra', defaultUni: 'JOR' },
  { table: 'ObraEqui', codCol: 'CodEqu', preCol: 'CosEqu', tipo: 'equipo', defaultUni: 'HORA' },
];

const COMPOSICION_SOURCES = [
  'ObraApinMate',
  'ObraApinMano',
  'ObraApinEqui',
  'ObraPainMate',
  'ObraPainMano',
  'ObraPainEqui',
] as const;

const COMPOSICION_TIPO: Partial<Record<(typeof COMPOSICION_SOURCES)[number], string>> = {
  ObraApinMate: 'material',
  ObraPainMate: 'material',
  ObraApinMano: 'mano_obra',
  ObraPainMano: 'mano_obra',
  ObraApinEqui: 'equipo',
  ObraPainEqui: 'equipo',
};

function strCell(v: unknown): string {
  return String(v ?? '').trim();
}

function numCell(
  raw: Record<string, unknown>,
  col: string | null,
  aliases: readonly string[],
): number {
  const row = normalizeLuloRow(raw);
  return leerValorNumericoFila(raw, row, col, aliases);
}

function tableByName(dump: LuloMdbFullDump, name: string): LuloMdbTableDump | undefined {
  const want = name.trim().toLowerCase();
  return dump.tables.find((t) => t.name.trim().toLowerCase() === want);
}

function readMigracionCsv(filePath: string, tableName: string): LuloMdbTableDump {
  const text = fs.readFileSync(filePath, 'utf8');
  const csv = extractFullLuloCsv(text);
  return {
    name: tableName,
    columns: csv.headers,
    rowCount: csv.rows.length,
    rows: csv.rows.map((r) => ({ ...r })),
  };
}

/** Lee `migracion_*.csv` exportados con `npm run mdb:export-csv`. */
export function loadLuloCsvFolder(csvDir: string): LuloMdbFullDump {
  const abs = path.resolve(csvDir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Carpeta CSV no encontrada: ${abs}`);
  }

  const tables: LuloMdbTableDump[] = [];
  for (const file of fs.readdirSync(abs)) {
    const m = /^migracion_(.+)\.csv$/i.exec(file);
    if (!m) continue;
    const tableName = m[1];
    tables.push(readMigracionCsv(path.join(abs, file), tableName));
  }

  if (tables.length === 0) {
    throw new Error(`No hay archivos migracion_*.csv en ${abs}`);
  }

  return { formato: 'mdb', creationDate: null, tables };
}

function mergeInsumos(dump: LuloMdbFullDump): LuloMdbTableDump | null {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const src of INSUMO_SOURCES) {
    const t = tableByName(dump, src.table);
    if (!t) continue;
    for (const raw of t.rows) {
      const cod = String(raw[src.codCol] ?? '').trim();
      if (!cod) continue;
      const key = cod.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const uni = src.uniCol ? String(raw[src.uniCol] ?? '').trim() : '';
      rows.push({
        CodIns: cod,
        DesIns: String(raw.Descri ?? raw.descri ?? cod).trim(),
        UniIns: uni || src.defaultUni,
        PreIns: Number(raw[src.preCol] ?? 0) || 0,
        TipIns: src.tipo,
      });
    }
  }

  if (rows.length === 0) return null;
  return {
    name: 'INSUMOS',
    columns: ['CodIns', 'DesIns', 'UniIns', 'PreIns', 'TipIns'],
    rowCount: rows.length,
    rows,
  };
}

function mergeComposicion(dump: LuloMdbFullDump): LuloMdbTableDump | null {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const name of COMPOSICION_SOURCES) {
    const t = tableByName(dump, name);
    if (!t) continue;
    const cCan = resolveLuloColumn(t.columns, LULO_COMPOSICION_COLS.cantidad);
    const cDes = resolveLuloColumn(t.columns, LULO_COMPOSICION_COLS.desperdicio);
    for (const raw of t.rows) {
      const codPar = String(raw.CodPar ?? '').trim();
      const codIns = String(raw.CodIns ?? '').trim();
      if (!codPar || !codIns) continue;
      const key = `${codPar}|${codIns}`.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const rowRaw = raw as Record<string, unknown>;
      rows.push({
        CodPar: codPar,
        CodIns: codIns,
        CanIns: numCell(rowRaw, cCan, LULO_COMPOSICION_COLS.cantidad),
        Desper: numCell(rowRaw, cDes, LULO_COMPOSICION_COLS.desperdicio),
      });
    }
  }

  if (rows.length === 0) return null;
  return {
    name: 'COMPOSICION',
    columns: ['CodPar', 'CodIns', 'CanIns', 'Desper'],
    rowCount: rows.length,
    rows,
  };
}

/** Insumos mínimos desde líneas APU cuando no hay ObraMate/Mano/Equi. */
function mergeInsumosDesdeApin(dump: LuloMdbFullDump): LuloMdbTableDump | null {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const bestPrecio = new Map<string, number>();

  for (const name of COMPOSICION_SOURCES) {
    const t = tableByName(dump, name);
    if (!t) continue;
    const tipo = COMPOSICION_TIPO[name] ?? 'material';
    for (const raw of t.rows) {
      const cod = strCell(raw.CodIns);
      if (!cod) continue;
      const key = cod.toUpperCase();
      const cos = Number(raw.CosIns ?? 0) || 0;
      if (!bestPrecio.has(key) || cos > (bestPrecio.get(key) ?? 0)) {
        bestPrecio.set(key, cos);
      }
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        CodIns: cod,
        DesIns: cod,
        UniIns: 'UND',
        PreIns: cos,
        TipIns: tipo,
      });
    }
  }

  if (rows.length === 0) return null;
  return {
    name: 'INSUMOS',
    columns: ['CodIns', 'DesIns', 'UniIns', 'PreIns', 'TipIns'],
    rowCount: rows.length,
    rows,
  };
}

/** Catálogo global ObraPart: Descri y UniPar por CodPar. */
function mapaCatalogoObraPart(dump: LuloMdbFullDump): {
  descripcion: Map<string, string>;
  unidad: Map<string, string>;
} {
  const descripcion = new Map<string, string>();
  const unidad = new Map<string, string>();
  const obraPart = tableByName(dump, 'ObraPart');
  if (!obraPart) return { descripcion, unidad };
  for (const raw of obraPart.rows) {
    const cod = strCell(raw.CodPar);
    if (!cod) continue;
    const key = cod.toUpperCase();
    const des = strCell(raw.Descri);
    if (des) descripcion.set(key, des);
    const uni = strCell(raw.UniPar);
    if (uni) unidad.set(key, uni);
  }
  return { descripcion, unidad };
}

/** ObraApun (presupuesto obra) + Descri/UniPar desde ObraPart. */
function partidasDesdeObraApun(
  dump: LuloMdbFullDump,
  codigoObra?: string,
): LuloMdbTableDump | null {
  const apun = tableByName(dump, 'ObraApun');
  if (!apun?.rows.length) return null;

  const filtro = codigoObra?.trim().toUpperCase();
  const cObr = resolveLuloColumn(apun.columns, LULO_PARTIDA_COLS.codigoObra);
  const cCan = resolveLuloColumn(apun.columns, LULO_PARTIDA_COLS.cantidad);
  const cPre = resolveLuloColumn(apun.columns, LULO_PARTIDA_COLS.precio);
  const cStot = resolveLuloColumn(apun.columns, LULO_PARTIDA_COLS.monto);
  const { descripcion: descri, unidad: unis } = mapaCatalogoObraPart(dump);

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const raw of apun.rows) {
    const rowRaw = raw as Record<string, unknown>;
    if (filtro && cObr) {
      const obr = strCell(rowRaw[cObr] ?? raw.CodObr);
      if (obr.toUpperCase() !== filtro) continue;
    }
    const codPar = strCell(raw.CodPar);
    if (!codPar) continue;
    const key = codPar.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const nota = strCell(raw.Nota01);
    const descripcion = descri.get(key)?.trim() || nota || codPar;

    const canPar = numCell(rowRaw, cCan, LULO_PARTIDA_COLS.cantidad);
    let preUni = numCell(rowRaw, cPre, LULO_PARTIDA_COLS.precio);
    const stotPar = numCell(rowRaw, cStot, LULO_PARTIDA_COLS.monto);
    if (!(preUni > 0) && stotPar > 0 && canPar > 0) {
      preUni = Math.round((stotPar / canPar) * 10000) / 10000;
    }

    rows.push({
      ...rowRaw,
      CodObr: rowRaw.CodObr ?? codigoObra ?? '',
      CodPar: codPar,
      DesPar: descripcion,
      UniPar: unis.get(key) || 'UND',
      CanPar: canPar,
      PreUni: preUni,
      STotPar: stotPar,
    });
  }

  if (rows.length === 0) return null;
  return {
    name: 'PARTIDAS',
    columns: ['CodObr', 'CodPar', 'DesPar', 'UniPar', 'CanPar', 'PreUni', 'STotPar'],
    rowCount: rows.length,
    rows,
  };
}

function partidasDesdeObraCapiPart(
  dump: LuloMdbFullDump,
  codigoObra?: string,
): LuloMdbTableDump | null {
  const capiPart = tableByName(dump, 'ObraCapiPart');
  if (!capiPart?.rows.length) return null;

  const cCan = resolveLuloColumn(capiPart.columns, LULO_PARTIDA_COLS.cantidad);
  const { descripcion: descripciones, unidad: unidades } = mapaCatalogoObraPart(dump);

  const filasCapi = filasObraCapiPart(capiPart, codigoObra);
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const raw of filasCapi) {
    const codPar = strCell(raw.CodPar);
    if (!codPar) continue;
    const key = codPar.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rowRaw = raw as Record<string, unknown>;
    rows.push({
      CodObr: raw.CodObr,
      CodPar: codPar,
      DesPar: descripciones.get(key) || codPar,
      UniPar: unidades.get(key) || strCell(raw.UniPar) || 'UND',
      CanPar: numCell(rowRaw, cCan, LULO_PARTIDA_COLS.cantidad),
      CodCap: raw.CodCap,
    });
  }

  if (rows.length === 0) return null;
  return {
    name: 'PARTIDAS',
    columns: ['CodObr', 'CodPar', 'DesPar', 'UniPar', 'CanPar', 'CodCap'],
    rowCount: rows.length,
    rows,
  };
}

/** Partidas mínimas a partir de códigos en ObraApin* / ObraPain* (sin ObraApun ni ObraCapiPart). */
function partidasDesdeObraApin(
  dump: LuloMdbFullDump,
  codigoObra?: string,
): LuloMdbTableDump | null {
  const filtro = codigoObra?.trim().toUpperCase();
  const capiPart = tableByName(dump, 'ObraCapiPart');
  const capPorPar = new Map<string, string>();
  const canParPorCod = new Map<string, number>();
  if (capiPart) {
    const cCanCapi = resolveLuloColumn(capiPart.columns, LULO_PARTIDA_COLS.cantidad);
    for (const raw of filasObraCapiPart(capiPart, codigoObra)) {
      const codPar = strCell(raw.CodPar);
      if (!codPar) continue;
      const key = codPar.toUpperCase();
      capPorPar.set(key, strCell(raw.CodCap));
      const can = numCell(raw as Record<string, unknown>, cCanCapi, LULO_PARTIDA_COLS.cantidad);
      if (can > 0 || !canParPorCod.has(key)) canParPorCod.set(key, can);
    }
  }

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const name of COMPOSICION_SOURCES) {
    const t = tableByName(dump, name);
    if (!t) continue;
    for (const raw of t.rows) {
      if (filtro && strCell(raw.CodObr).toUpperCase() !== filtro) continue;
      const codPar = strCell(raw.CodPar);
      if (!codPar) continue;
      const key = codPar.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        CodObr: raw.CodObr ?? codigoObra ?? '',
        CodPar: codPar,
        DesPar: codPar,
        UniPar: 'UND',
        CanPar: canParPorCod.get(key) ?? 0,
        CodCap: capPorPar.get(key) ?? '',
      });
    }
  }

  if (rows.length === 0) return null;
  return {
    name: 'PARTIDAS',
    columns: ['CodObr', 'CodPar', 'DesPar', 'UniPar', 'CanPar', 'CodCap'],
    rowCount: rows.length,
    rows,
  };
}

function detectCodigoObraUnico(dump: LuloMdbFullDump): string | undefined {
  const codes = new Set<string>();
  const fuentes = ['ObraApun', 'ObraCapi', 'ObraCapiPart', ...COMPOSICION_SOURCES] as const;
  for (const nombre of fuentes) {
    const t = tableByName(dump, nombre);
    if (!t) continue;
    for (const raw of t.rows) {
      const c = strCell(raw.CodObr);
      if (c) codes.add(c.toUpperCase());
    }
  }
  if (codes.size === 1) return Array.from(codes)[0];
  return undefined;
}

function obraDesdeApun(dump: LuloMdbFullDump, codigoObra?: string): LuloMdbTableDump | null {
  const apun = tableByName(dump, 'ObraApun');
  if (!apun?.rows.length) return null;

  const prefer = codigoObra?.trim().toUpperCase();
  let row = apun.rows[0] as Record<string, unknown>;
  if (prefer) {
    const hit = apun.rows.find(
      (r) => String((r as Record<string, unknown>).CodObr ?? '').trim().toUpperCase() === prefer,
    );
    if (hit) row = hit as Record<string, unknown>;
  }

  const codObr = String(row.CodObr ?? '').trim();
  if (!codObr) return null;

  return {
    name: 'OBRAS',
    columns: ['CodObr', 'NomObr', 'PerAdm', 'PerUti', 'PerFcm'],
    rowCount: 1,
    rows: [
      {
        CodObr: codObr,
        NomObr: codObr,
        PerAdm: Number(row.AdmIni ?? 0) || 0,
        PerUti: Number(row.Utilid ?? 0) || 0,
        PerFcm: Number(row.Financ ?? 0) || 0,
      },
    ],
  };
}

function obraDesdeObraCapi(dump: LuloMdbFullDump, codigoObra?: string): LuloMdbTableDump | null {
  const capi = tableByName(dump, 'ObraCapi');
  if (!capi?.rows.length) return null;

  const filtro = codigoObra?.trim().toUpperCase();
  let row = capi.rows[0] as Record<string, unknown>;
  if (filtro) {
    const hit = capi.rows.find(
      (r) => strCell((r as Record<string, unknown>).CodObr).toUpperCase() === filtro,
    );
    if (hit) row = hit as Record<string, unknown>;
  }

  const codObr = strCell(row.CodObr);
  if (!codObr) return null;

  return {
    name: 'OBRAS',
    columns: ['CodObr', 'NomObr', 'PerAdm', 'PerUti', 'PerFcm'],
    rowCount: 1,
    rows: [
      {
        CodObr: codObr,
        NomObr: strCell(row.DesCap) || codObr,
        PerAdm: 0,
        PerUti: 0,
        PerFcm: 0,
      },
    ],
  };
}

/** MDB/CSV con tablas Obra* (presupuesto de obra LuloWin), sin PARTIDAS/INSUMOS canónicas. */
export function luloMdbHasEstructuraObra(dump: LuloMdbFullDump): boolean {
  const hasPartidas = ['ObraApun', 'ObraPart', 'ObraCapiPart'].some((n) => {
    const t = tableByName(dump, n);
    return (t?.rows.length ?? 0) > 0;
  });
  const hasApu = COMPOSICION_SOURCES.some((n) => (tableByName(dump, n)?.rows.length ?? 0) > 0);
  const hasInsumos = INSUMO_SOURCES.some((s) => (tableByName(dump, s.table)?.rows.length ?? 0) > 0);
  const hasCapi = (tableByName(dump, 'ObraCapi')?.rows.length ?? 0) > 0;
  return (hasPartidas && (hasApu || hasInsumos)) || (hasApu && hasCapi) || hasApu;
}

/**
 * Añade tablas canónicas (PARTIDAS, INSUMOS, COMPOSICION, CAPITULOS, OBRAS)
 * para que el parser LuloWin reconozca volcados Obra* (.mdb o CSV).
 */
export function normalizeObraMdbDump(
  dump: LuloMdbFullDump,
  opts?: { codigoObra?: string },
): LuloMdbFullDump {
  const extra: LuloMdbTableDump[] = [];
  const codigoObra =
    opts?.codigoObra?.trim() || detectCodigoObraUnico(dump) || undefined;

  const obraApun = tableByName(dump, 'ObraApun');
  const obraPart = tableByName(dump, 'ObraPart');
  const desdeApun = partidasDesdeObraApun(dump, codigoObra);
  if (desdeApun) {
    extra.push(desdeApun);
  } else if (obraPart?.rows.length) {
    extra.push({ ...obraPart, name: 'PARTIDAS' });
  } else {
    const desdeCapiPart = partidasDesdeObraCapiPart(dump, codigoObra);
    if (desdeCapiPart) {
      extra.push(desdeCapiPart);
    } else {
      const desdeApin = partidasDesdeObraApin(dump, codigoObra);
      if (desdeApin) extra.push(desdeApin);
    }
  }

  const insumos = mergeInsumos(dump) ?? mergeInsumosDesdeApin(dump);
  if (insumos) extra.push(insumos);

  const composicion = mergeComposicion(dump);
  if (composicion) extra.push(composicion);

  const obraCapi = tableByName(dump, 'ObraCapi');
  if (obraCapi?.rows.length) {
    extra.push({ ...obraCapi, name: 'CAPITULOS' });
  }

  const obras =
    obraDesdeApun(dump, codigoObra) ?? obraDesdeObraCapi(dump, codigoObra);
  if (obras) extra.push(obras);

  return { ...dump, tables: [...dump.tables, ...extra] };
}

/**
 * Convierte MDB Obra* al formato PARTIDAS/INSUMOS/COMPOSICION antes de parsear.
 * Idempotente: si ya hay tablas nativas con filas, devuelve el dump sin cambios.
 */
export function prepareLuloMdbDumpForParse(
  dump: LuloMdbFullDump,
  opts?: { codigoObra?: string },
): LuloMdbFullDump {
  const partidasNativas = dump.tables.find(
    (t) => t.name.trim().toUpperCase() === 'PARTIDAS' && t.rows.length > 0,
  );
  if (partidasNativas) return dump;
  if (!luloMdbHasEstructuraObra(dump)) return dump;
  return normalizeObraMdbDump(dump, opts);
}

/** @deprecated Use normalizeObraMdbDump */
export const normalizeLuloWinCsvDump = normalizeObraMdbDump;

/** Carga CSV y deja el dump listo para `parseLuloMdbEstructurado` / cascada. */
export function loadAndNormalizeLuloCsvFolder(
  csvDir: string,
  opts?: { codigoObra?: string },
): LuloMdbFullDump {
  const raw = loadLuloCsvFolder(csvDir);
  return normalizeObraMdbDump(raw, opts);
}
