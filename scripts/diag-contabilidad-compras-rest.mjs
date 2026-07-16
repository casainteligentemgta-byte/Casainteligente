/**
 * Diagnóstico vía PostgREST (sin conexión Postgres directa).
 * Uso: node scripts/diag-contabilidad-compras-rest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function probeSelect(base, key, select) {
  const url = `${base}/rest/v1/contabilidad_compras?select=${encodeURIComponent(select)}&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 300) };
}

async function probePatch(base, key, compraId, body) {
  const url = `${base}/rest/v1/contabilidad_compras?id=eq.${compraId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 300) };
}

async function main() {
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const base = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    env.SUPABASE_SECRET_KEY?.trim() ||
    env.SUPABASE_SERVICE_KEY?.trim();
  if (!base || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o service role key');

  console.log('Proyecto:', base.replace('https://', ''));

  for (const col of ['id,fecha', 'updated_at', 'alerta_fecha,fecha_confirmada_manual']) {
    const r = await probeSelect(base, key, col);
    console.log(`\nSELECT ${col} → HTTP ${r.status}`);
    console.log(r.text || '(vacío)');
  }

  const one = await probeSelect(base, key, 'id,fecha');
  let compraId = null;
  try {
    const rows = JSON.parse(one.text);
    compraId = rows?.[0]?.id ?? null;
  } catch {
    /* */
  }

  if (compraId) {
    console.log(`\nCompra de prueba: ${compraId}`);
    const sinUpdated = await probePatch(base, key, compraId, { alerta_fecha: null });
    console.log(`PATCH sin updated_at → HTTP ${sinUpdated.status}`, sinUpdated.text || 'OK');

    const conUpdated = await probePatch(base, key, compraId, {
      updated_at: new Date().toISOString(),
    });
    console.log(`PATCH con updated_at → HTTP ${conUpdated.status}`, conUpdated.text || 'OK');
  }
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
