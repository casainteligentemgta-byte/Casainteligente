/**
 * Lista tablas de un archivo LuloWin (.mdb / .accdb).
 *
 * Uso:
 *   node scripts/list-mdb-tables.mjs "C:\ruta\presupuesto.mdb"
 *   npm run mdb:list-tables -- "C:\ruta\presupuesto.mdb"
 *
 * Opciones:
 *   --all     incluye tablas de sistema (MSys*)
 *   --rows    muestra conteo de filas por tabla
 */
import fs from 'fs';
import path from 'path';
import MDBReader from 'mdb-reader';

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('-')));

const filePath = args[0];
const includeSystem = flags.has('--all');
const showRows = flags.has('--rows') || !flags.has('--no-rows');

if (!filePath) {
  console.error('❌ Indica la ruta al .mdb / .accdb de LuloWin.');
  console.error('   Ejemplo: npm run mdb:list-tables -- ".\\presupuesto.mdb"');
  process.exit(1);
}

const abs = path.resolve(filePath);
if (!fs.existsSync(abs)) {
  console.error(`❌ No existe el archivo: ${abs}`);
  process.exit(1);
}

const ext = path.extname(abs).toLowerCase();
if (ext !== '.mdb' && ext !== '.accdb') {
  console.warn(`⚠️  Extensión "${ext}" — se intentará leer igual como Access.`);
}

let buffer;
try {
  buffer = fs.readFileSync(abs);
} catch (e) {
  console.error('❌ No se pudo leer el archivo:', e instanceof Error ? e.message : e);
  process.exit(1);
}

if (buffer.length < 2048) {
  console.error('❌ Archivo demasiado pequeño o vacío.');
  process.exit(1);
}

let reader;
try {
  reader = new MDBReader(buffer);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/password/i.test(msg)) {
    console.error('❌ La base tiene contraseña. Quítala en Lulo/Access y reexporta.');
  } else if (/Wrong page type|Unsupported version/i.test(msg)) {
    console.error('❌ MDB corrupto o versión no soportada:', msg);
  } else {
    console.error('❌ Error al abrir MDB:', msg);
  }
  process.exit(1);
}

const normal = reader.getTableNames({ normalTables: true, systemTables: false });
const system = includeSystem
  ? reader.getTableNames({ normalTables: false, systemTables: true })
  : [];

console.log(`\n📂 ${path.basename(abs)} (${(buffer.length / 1024).toFixed(1)} KB)`);
const created = reader.getCreationDate?.();
if (created) console.log(`   Creado: ${created.toISOString()}`);

console.log(`\n📋 Tablas de usuario (${normal.length}):\n`);
for (const name of normal.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))) {
  if (showRows) {
    try {
      const table = reader.getTable(name);
      const rows = table.getData().length;
      const cols = table.getColumnNames().join(', ');
      console.log(`  • ${name}  (${rows} filas)`);
      console.log(`      columnas: ${cols || '—'}`);
    } catch {
      console.log(`  • ${name}  (no legible)`);
    }
  } else {
    console.log(`  • ${name}`);
  }
}

if (includeSystem && system.length > 0) {
  console.log(`\n🔧 Tablas de sistema (${system.length}):\n`);
  for (const name of system.sort()) {
    console.log(`  • ${name}`);
  }
}

console.log('\n✅ Listo.\n');
