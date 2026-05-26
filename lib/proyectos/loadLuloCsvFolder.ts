import fs from 'fs';
import path from 'path';
import { extractFullLuloCsv, type LuloMdbFullDump, type LuloMdbTableDump } from '@/lib/proyectos/extractLuloFull';

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

const COMPOSICION_SOURCES = ['ObraApinMate', 'ObraApinMano', 'ObraApinEqui'] as const;

function tableByName(dump: LuloMdbFullDump, name: string): LuloMdbTableDump | undefined {
  return dump.tables.find((t) => t.name === name);
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
    for (const raw of t.rows) {
      const codPar = String(raw.CodPar ?? '').trim();
      const codIns = String(raw.CodIns ?? '').trim();
      if (!codPar || !codIns) continue;
      const key = `${codPar}|${codIns}`.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        CodPar: codPar,
        CodIns: codIns,
        CanIns: Number(raw.CanIns ?? 0) || 0,
        Desper: Number(raw.Desper ?? 0) || 0,
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

/**
 * Añade tablas canónicas (PARTIDAS, INSUMOS, COMPOSICION, CAPITULOS, OBRAS)
 * para que el parser LuloWin reconozca el volcado CSV igual que un .mdb.
 */
export function normalizeLuloWinCsvDump(
  dump: LuloMdbFullDump,
  opts?: { codigoObra?: string },
): LuloMdbFullDump {
  const extra: LuloMdbTableDump[] = [];

  const obraApun = tableByName(dump, 'ObraApun');
  const obraPart = tableByName(dump, 'ObraPart');
  if (obraApun?.rows.length) {
    extra.push({ ...obraApun, name: 'PARTIDAS' });
  } else if (obraPart?.rows.length) {
    extra.push({ ...obraPart, name: 'PARTIDAS' });
  }

  const insumos = mergeInsumos(dump);
  if (insumos) extra.push(insumos);

  const composicion = mergeComposicion(dump);
  if (composicion) extra.push(composicion);

  const obraCapi = tableByName(dump, 'ObraCapi');
  if (obraCapi?.rows.length) {
    extra.push({ ...obraCapi, name: 'CAPITULOS' });
  }

  const obras = obraDesdeApun(dump, opts?.codigoObra);
  if (obras) extra.push(obras);

  return { ...dump, tables: [...dump.tables, ...extra] };
}

/** Carga CSV y deja el dump listo para `parseLuloMdbEstructurado` / cascada. */
export function loadAndNormalizeLuloCsvFolder(
  csvDir: string,
  opts?: { codigoObra?: string },
): LuloMdbFullDump {
  const raw = loadLuloCsvFolder(csvDir);
  return normalizeLuloWinCsvDump(raw, opts);
}
