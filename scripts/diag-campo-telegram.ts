import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/resolveServiceRoleKey';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  resolveSupabaseServiceRoleKey()!,
);

async function main() {
  const { data: proys } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, codigo_lulo, ingeniero_residente_id')
    .not('ingeniero_residente_id', 'is', null)
    .limit(20);

  console.log('Proyectos con ingeniero_residente_id:', proys?.length ?? 0);
  for (const p of proys ?? []) {
    const { data: emp } = await supabase
      .from('ci_empleados')
      .select('nombre_completo, cargo_nombre, telegram_chat_id')
      .eq('id', p.ingeniero_residente_id)
      .maybeSingle();
    console.log(
      `  - ${p.nombre} (${p.codigo_lulo ?? '?'}) → ${emp?.nombre_completo ?? p.ingeniero_residente_id} | telegram=${emp?.telegram_chat_id ?? 'NO'}`,
    );
  }

  const { count: empCount } = await supabase
    .from('ci_empleados')
    .select('id', { count: 'exact', head: true })
    .not('telegram_chat_id', 'is', null);

  console.log(`\nEmpleados con Telegram vinculado: ${empCount ?? 0}`);
  console.log(
    '\nListos para cron:',
    (proys ?? []).filter(async () => false).length,
    '(ver filas con telegram arriba)',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
