import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

async function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const envPath = path.join(root, '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim();
    }
  }
  process.env.SUPABASE_DEV_INSECURE_TLS = '1';

  const { createSupabaseAdminOnlyClient } = await import('../lib/supabase/adminOnlyClient');
  const supabase = createSupabaseAdminOnlyClient();
  if (!supabase) throw new Error('Sin Supabase');

  const pid = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
  const { data: caps, error } = await supabase
    .from('capitulos')
    .select('id, codigo, nombre, created_at')
    .eq('proyecto_id', pid)
    .order('codigo');
  if (error) throw error;
  console.log('Total capitulos en DB:', caps?.length ?? 0);
  for (const c of caps ?? []) {
    console.log(JSON.stringify({ codigo: c.codigo, nombre: String(c.nombre).slice(0, 70) }));
  }

  const capIds = (caps ?? []).map((c) => c.id);
  const { count } = await supabase
    .from('partidas')
    .select('id', { count: 'exact', head: true })
    .in('capitulo_id', capIds);
  console.log('Partidas enlazadas a esos caps:', count);

  const { count: ci } = await supabase
    .from('ci_presupuesto_partidas')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', pid);
  console.log('ci_presupuesto_partidas:', ci);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
