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

const PID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('registros_gastos')
      .select('descripcion,monto_base_usd,honorarios,costo_total,porcentaje_admin,clase')
      .eq('proyecto_id', PID)
      .eq('clase', 'GASTO')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data as Record<string, unknown>[]) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  const big = rows
    .filter((r) => Number(r.honorarios) > 1000)
    .sort((a, b) => Number(b.honorarios) - Number(a.honorarios))
    .slice(0, 15)
    .map((r) => ({
      desc: r.descripcion,
      base: r.monto_base_usd,
      hon: r.honorarios,
      costo: r.costo_total,
      pct: r.porcentaje_admin,
    }));

  const honSum = rows.reduce((s, r) => s + (Number(r.honorarios) || 0), 0);
  const nullBase = rows.filter((r) => r.monto_base_usd == null).length;
  console.log(JSON.stringify({ n: rows.length, nullBase, honSum, big }, null, 2));
}

main().catch(console.error);
