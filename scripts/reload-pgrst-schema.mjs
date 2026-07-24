/** Ejecuta: notify pgrst, 'reload schema'; */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');

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
  const projectRef =
    env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const url = env.DATABASE_POOLER_URL?.trim() || env.DATABASE_URL?.trim();
  if (!url) {
    console.error('Falta DATABASE_URL en .env.local');
    process.exit(1);
  }

  let sql = postgres(url, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });
  try {
    await sql`select 1`;
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    const m = url.match(/^postgresql:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (!m || !projectRef) {
      console.error('No se pudo conectar. Use DATABASE_POOLER_URL del dashboard Supabase.');
      process.exit(1);
    }
    sql = postgres({
      user: `postgres.${projectRef}`,
      password: decodeURIComponent(m[2]),
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      database: m[5],
      max: 1,
      prepare: false,
      ssl: { rejectUnauthorized: false },
    });
    await sql`select 1`;
    console.log('Conectado vía pooler');
  }

  await sql.unsafe("notify pgrst, 'reload schema'");
  console.log("OK: notify pgrst, 'reload schema'");
  await sql.end({ timeout: 2 });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
