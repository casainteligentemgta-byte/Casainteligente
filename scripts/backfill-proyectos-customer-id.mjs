/**
 * Dry-run: sugiere customer_id para ci_proyectos sin cliente.
 *
 * Uso:
 *   node scripts/backfill-proyectos-customer-id.mjs           # solo informe
 *   node scripts/backfill-proyectos-customer-id.mjs --apply   # aplica matches únicos por nombre
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function displayCustomer(c) {
  return String(c.razon_social ?? '').trim() || [c.nombre, c.apellido].filter(Boolean).join(' ').trim();
}

async function main() {
  const { data: customers, error: cErr } = await sb
    .from('customers')
    .select('id, nombre, apellido, razon_social, rif');
  if (cErr) throw new Error(cErr.message);

  const byNombre = new Map();
  for (const c of customers ?? []) {
    const keys = new Set([
      norm(displayCustomer(c)),
      norm(c.nombre),
      norm(c.razon_social),
    ].filter(Boolean));
    for (const k of keys) {
      if (!byNombre.has(k)) byNombre.set(k, []);
      byNombre.get(k).push(c);
    }
  }

  let proys = null;
  {
    const r = await sb
      .from('ci_proyectos')
      .select('id, nombre, customer_id, obra_cliente, entidad_id')
      .is('customer_id', null);
    if (r.error && /obra_cliente|42703|column/i.test(r.error.message ?? '')) {
      const r2 = await sb
        .from('ci_proyectos')
        .select('id, nombre, customer_id, entidad_id')
        .is('customer_id', null);
      if (r2.error) throw new Error(r2.error.message);
      proys = (r2.data ?? []).map((p) => ({ ...p, obra_cliente: null }));
    } else {
      if (r.error) throw new Error(r.error.message);
      proys = r.data;
    }
  }

  if (!proys?.length) {
    console.log('OK — todas las obras tienen customer_id asignado.');
    return;
  }

  console.log(`Obras sin customer_id: ${proys.length}`);
  console.log(apply ? 'Modo: APPLY (solo matches únicos por nombre)\n' : 'Modo: dry-run\n');

  let aplicados = 0;
  let ambiguos = 0;
  let sinMatch = 0;

  for (const p of proys) {
    const candidatosTexto = [p.obra_cliente, p.nombre].map(norm).filter(Boolean);
    let match = null;
    let matchKey = '';

    for (const key of candidatosTexto) {
      const lista = byNombre.get(key);
      if (lista?.length === 1) {
        match = lista[0];
        matchKey = key;
        break;
      }
      if (lista && lista.length > 1) {
        ambiguos++;
        console.log(`AMBIGUO | obra ${p.id} | ${p.nombre}`);
        console.log(`  texto="${key}" → ${lista.length} customers posibles`);
        match = null;
        break;
      }
    }

    if (!match) {
      if (!candidatosTexto.some((k) => (byNombre.get(k)?.length ?? 0) > 1)) {
        sinMatch++;
        console.log(`SIN MATCH | obra ${p.id} | ${p.nombre} | obra_cliente=${p.obra_cliente ?? '—'}`);
      }
      continue;
    }

    const label = displayCustomer(match);
    console.log(`MATCH | obra ${p.id} | ${p.nombre} → customer ${match.id} (${label}) [${matchKey}]`);

    if (apply) {
      const { error } = await sb
        .from('ci_proyectos')
        .update({ customer_id: match.id })
        .eq('id', p.id)
        .is('customer_id', null);
      if (error) {
        console.error(`  ERROR apply: ${error.message}`);
      } else {
        aplicados++;
      }
    }
  }

  console.log('\n=== Resumen ===');
  console.log(`Sin match: ${sinMatch}`);
  console.log(`Ambiguos: ${ambiguos}`);
  if (apply) console.log(`Aplicados: ${aplicados}`);
  else if (sinMatch + ambiguos < proys.length) {
    console.log('Hay matches únicos listos. Revisa arriba y ejecuta con --apply si procede.');
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
