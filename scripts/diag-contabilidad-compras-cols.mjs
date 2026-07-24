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

async function main() {
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL vacía');

  const sql = postgres(url, { max: 1, ssl: { rejectUnauthorized: false } });
  try {
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'contabilidad_compras'
      order by column_name
    `;
    const set = cols.map((c) => c.column_name);
    console.log('Columnas contabilidad_compras:', set.join(', '));
    for (const c of ['updated_at', 'alerta_fecha', 'fecha_confirmada_manual']) {
      console.log(`${c}:`, set.includes(c) ? 'SI' : 'NO');
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
