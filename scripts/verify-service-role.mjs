/**
 * Comprueba que SUPABASE_SERVICE_ROLE_KEY en .env.local sea aceptada por PostgREST (misma URL que el proyecto).
 * Uso: node scripts/verify-service-role.mjs
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
  if (!fs.existsSync(envPath)) {
    console.error('No existe .env.local');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  let url = (env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const k = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !k) {
    console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
    process.exit(1);
  }
  const parts = k.split('.');
  console.log('JWT segmentos:', parts.length, '(debe ser 3)');
  console.log('Longitud clave:', k.length, 'caracteres');
  const testUrl = `${url}/rest/v1/ci_proyectos?select=id&limit=1`;
  const res = await fetch(testUrl, {
    headers: {
      apikey: k,
      Authorization: `Bearer ${k}`,
    },
  });
  const body = await res.text();
  console.log('HTTP', res.status, res.statusText);
  console.log('Cuerpo (recorte):', body.slice(0, 400));
  if (res.ok) {
    console.log('\nOK: la service_role es válida para esta URL.');
    process.exit(0);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
