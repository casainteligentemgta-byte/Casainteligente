import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const REQUIRED = [
  'proyecto_id',
  'entidad_id',
  'imputacion',
  'ubicacion_destino_id',
  'compra_factura_id',
  'ingresado_almacen_at',
];

async function main() {
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL vacía');

  const sql = postgres(url, { max: 1, ssl: { rejectUnauthorized: false } });
  try {
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'contabilidad_compras'
    `;
    const set = new Set(cols.map((c) => c.column_name));
    const missing = REQUIRED.filter((c) => !set.has(c));
    console.log('Columnas presentes:', [...set].sort().join(', '));
    console.log('Faltan:', missing.length ? missing.join(', ') : '(ninguna requerida)');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
