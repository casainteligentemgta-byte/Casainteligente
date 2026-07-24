import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
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
  const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: flam } = await sb
    .from('ci_proyectos')
    .select('id,nombre')
    .ilike('nombre', '%FLAMBOYANT%')
    .maybeSingle();
  if (!flam) {
    console.log('Sin Flamboyant');
    return;
  }

  for (const table of ['ci_insumos', 'ci_presupuesto_insumos', 'obra_partidas_materiales']) {
    const { error } = await sb.from(table).select('id').limit(1);
    console.log(table, error ? `NO (${error.message.slice(0, 60)})` : 'OK');
  }

  const { data: insumos, error: insErr } = await sb
    .from('ci_insumos')
    .select('id,descripcion,codigo')
    .ilike('descripcion', '%cabill%')
    .limit(10);
  console.log(
    'ci_insumos cabill*:',
    insErr?.message ?? ((insumos ?? []).map((x) => x.descripcion).join(' | ') || '(0)'),
  );

  const { data: lulo, error: luloErr } = await sb
    .from('ci_lulo_insumos_maestro')
    .select('codigo,descripcion')
    .ilike('descripcion', '%cabill%')
    .limit(10);
  console.log(
    'lulo cabill*:',
    luloErr?.message ?? ((lulo ?? []).map((x) => x.descripcion).join(' | ') || '(0)'),
  );

  const { data: stock } = await sb
    .from('inventario_stock')
    .select('material_id, global_inventory(name)')
    .gt('cantidad_disponible', 0)
    .limit(20);
  console.log('\nStock con cantidad > 0:', stock?.length ?? 0);
  for (const s of stock ?? []) {
    const name = (s as { global_inventory?: { name?: string } }).global_inventory?.name;
    console.log(' -', name);
  }
}

main().catch(console.error);
