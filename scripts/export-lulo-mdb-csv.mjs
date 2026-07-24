/**
 * Exporta tablas LuloWin (.mdb) a CSV sin ODBC (usa mdb-reader, igual que la app).
 *
 * Uso:
 *   node scripts/export-lulo-mdb-csv.mjs "C:\Users\...\576PDVSA.MDB"
 *   npm run mdb:export-csv -- "C:\Users\...\576PDVSA.MDB" --out ./export_lulo_csv
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MDBReader from 'mdb-reader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TABLAS_CRITICAS = new Set([
  'ObraApun',
  'ObraPart',
  'ObraMate',
  'ObraMano',
  'ObraEqui',
  'ObraApinMate',
  'ObraApinMano',
  'ObraApinEqui',
  'ObraCapi',
  'ObraCapiPart',
]);

function parseArgs(argv) {
  const flags = new Set();
  const pos = [];
  for (const a of argv) {
    if (a.startsWith('-')) flags.add(a);
    else pos.push(a);
  }
  const outIdx = argv.indexOf('--out');
  const outDir =
    outIdx >= 0 && argv[outIdx + 1] ? argv[outIdx + 1] : './export_lulo_csv';
  return {
    mdbPath: pos[0],
    outDir,
    soloCriticas: flags.has('--solo-criticas'),
  };
}

function escapeCsv(val) {
  if (val == null) return '';
  let s;
  if (val instanceof Date) s = val.toISOString();
  else if (Buffer.isBuffer(val)) s = val.toString('base64');
  else s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(columns, rows) {
  const header = columns.map(escapeCsv).join(',');
  const lines = rows.map((row) => {
    const obj = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
    return columns.map((col) => escapeCsv(obj[col])).join(',');
  });
  return `\ufeff${header}\n${lines.join('\n')}\n`;
}

function exportTable(reader, tableName, outDir) {
  const table = reader.getTable(tableName);
  const columns = table.getColumnNames();
  const rows = table.getData();
  const csv = rowsToCsv(columns, rows);
  const dest = path.join(outDir, `migracion_${tableName}.csv`);
  fs.writeFileSync(dest, csv, 'utf8');
  return rows.length;
}

function main() {
  const { mdbPath, outDir, soloCriticas } = parseArgs(process.argv.slice(2));
  if (!mdbPath) {
    console.error('❌ Indica la ruta al .mdb');
    console.error('   Ejemplo: npm run mdb:export-csv -- "C:\\...\\576PDVSA.MDB"');
    process.exit(1);
  }

  const abs = path.resolve(mdbPath);
  if (!fs.existsSync(abs)) {
    console.error(`❌ No existe: ${abs}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(abs);
  if (buffer.length < 2048) {
    console.error('❌ Archivo vacío o placeholder de iCloud. Usa el .mdb descargado completo.');
    process.exit(1);
  }

  let reader;
  try {
    reader = new MDBReader(buffer);
  } catch (e) {
    console.error('❌ Error al abrir MDB:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const tablas = reader
    .getTableNames({ normalTables: true, systemTables: false })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  console.log('Tablas encontradas:', tablas.length);

  const objetivo = soloCriticas
    ? tablas.filter((t) => TABLAS_CRITICAS.has(t))
    : tablas.filter((t) => TABLAS_CRITICAS.has(t) || t.startsWith('Obra'));

  if (objetivo.length === 0) {
    console.error('❌ No hay tablas Obra* para exportar.');
    process.exit(1);
  }

  fs.mkdirSync(path.resolve(outDir), { recursive: true });

  for (const tabla of objetivo) {
    try {
      const filas = exportTable(reader, tabla, path.resolve(outDir));
      console.log(`Exportada: ${tabla} (${filas} filas)`);
    } catch (e) {
      console.warn(`⚠️  ${tabla}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n✅ CSV en: ${path.resolve(outDir)}`);
}

main();
