import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

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

  const withArg = await sb.rpc('ci_commit_registros_gastos_from_staging', {
    p_proyecto_id: '171694ed-0ecb-4ec5-82f5-82b980cb261f',
  });
  console.log('withArg', withArg.error?.message ?? withArg.data);

  const noArg = await sb.rpc('ci_commit_registros_gastos_from_staging');
  console.log('noArg', noArg.error?.message ?? noArg.data);
}

main().catch(console.error);
