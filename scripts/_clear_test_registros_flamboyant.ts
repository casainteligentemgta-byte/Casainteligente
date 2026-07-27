/**
 * Limpia filas de prueba del import idempotente en Flamboyant.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

const FL = '171694ed-0ecb-4ec5-82f5-82b980cb261f';

for (const p of ['.env.local', '.env']) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    if (process.env[key]) continue;
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const probe = await sb.from('registros_gastos').select('id,proyecto_id,descripcion').limit(5);
  console.log(
    JSON.stringify({ probeError: probe.error?.message ?? null, sample: probe.data }, null, 2),
  );

  const { count: before } = await sb
    .from('registros_gastos')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', FL);

  const { error: delErr } = await sb.from('registros_gastos').delete().eq('proyecto_id', FL);
  const { count: after } = await sb
    .from('registros_gastos')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', FL);

  console.log(JSON.stringify({ before, delErr: delErr?.message ?? null, after }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
