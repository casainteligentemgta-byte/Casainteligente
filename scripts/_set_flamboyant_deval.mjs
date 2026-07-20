/**
 * Fija devaluación V4 (BCV→Binance) en cco_proyecto_config para Flamboyant.
 * Factor: oficial_ingresos / real_binance − 1 ≈ 34,449%.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  let k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim().replace(/^["']+|["']+$/g, '');
  env[k] = v;
}

const FLAM = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const DEVAL = 34.4491; // 625265 / 465057.15176717774 - 1

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: existing } = await sb
  .from('cco_proyecto_config')
  .select('*')
  .eq('proyecto_id', FLAM)
  .maybeSingle();

const row = {
  proyecto_id: FLAM,
  honorarios_admin_pct: Number(existing?.honorarios_admin_pct) || 15,
  devaluacion_pct: DEVAL,
  obra_alias: existing?.obra_alias ?? 'RANCHO FLAMBOYANT',
  empresa_nombre: existing?.empresa_nombre ?? null,
  area_m2: existing?.area_m2 ?? null,
  updated_at: new Date().toISOString(),
};

const { data, error } = await sb
  .from('cco_proyecto_config')
  .upsert(row, { onConflict: 'proyecto_id' })
  .select()
  .maybeSingle();

if (error) {
  console.error(error);
  process.exit(1);
}
console.log('OK config', data);
