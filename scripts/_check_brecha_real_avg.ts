process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const root = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const PID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';

async function main() {
  const rows: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('registros_gastos')
      .select('porcentaje_brecha_real')
      .eq('proyecto_id', PID)
      .not('porcentaje_brecha_real', 'is', null)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  let sum = 0;
  let count = 0;
  for (const r of rows) {
    const v = Number(r.porcentaje_brecha_real);
    if (Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  const avg = count > 0 ? sum / count : 0;
  console.log('Average brecha_real:', avg, 'Count:', count);
  console.log('Math.round((sum / count) * 10000) / 10000:', Math.round((sum / count) * 10000) / 10000);
}

main().catch(console.error);