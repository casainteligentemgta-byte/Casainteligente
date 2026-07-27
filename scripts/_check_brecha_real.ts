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
  const { data, error } = await sb
    .from('registros_gastos')
    .select('porcentaje_brecha_real')
    .eq('proyecto_id', PID)
    .not('porcentaje_brecha_real', 'is', null);
  if (error) throw error;

  let sum = 0;
  let count = 0;
  for (const r of data || []) {
    const v = Number(r.porcentaje_brecha_real);
    if (Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  console.log('Average brecha_real:', count > 0 ? sum / count : 0, 'Count:', count);
}

main().catch(console.error);