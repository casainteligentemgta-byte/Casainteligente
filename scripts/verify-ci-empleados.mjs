/**
 * Comprueba que la tabla public.ci_empleados exista vía PostgREST (misma ruta que la app).
 * Uso: npm run verify:ci-empleados
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
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
  console.log('Casa Inteligente — verificación tabla ci_empleados\n');

  if (!fs.existsSync(envPath)) {
    console.error('❌ No existe .env.local');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
  const key = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !key) {
    console.error('❌ Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const endpoint = `${url}/rest/v1/ci_empleados?select=id&limit=1`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (res.ok) {
    console.log('✅ Tabla public.ci_empleados accesible (GET 200).');
    process.exit(0);
  }

  console.error(`❌ HTTP ${res.status}`);
  console.error(typeof body === 'object' ? JSON.stringify(body, null, 2) : body);
  console.error('\n→ En Supabase: SQL Editor → ejecuta el archivo:');
  console.error('   supabase/manual_ci_empleados_solo.sql');
  console.error('→ Luego: Project Settings → API → Reload schema (o espera 1–2 min).\n');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
