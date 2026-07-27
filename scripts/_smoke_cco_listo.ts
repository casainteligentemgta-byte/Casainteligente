/**
 * Smoke check: columnas, RPC por obra, conteo Flamboyant.
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

  const probe = await sb.from('registros_gastos').select('id,proyecto_id').limit(1);
  const { count } = await sb
    .from('registros_gastos')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', FL);
  const rpc = await sb.rpc('ci_commit_registros_gastos_from_staging', {
    p_proyecto_id: FL,
  });

  console.log(
    JSON.stringify({
      ok: !probe.error,
      proyectoIdColumna: !probe.error,
      filasFlamboyant: count ?? 0,
      rpcPorObra: rpc.error?.message?.includes('Staging vacío')
        ? 'OK'
        : rpc.error?.message ?? 'OK',
      listoParaImportRancho: (count ?? 0) === 0,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
