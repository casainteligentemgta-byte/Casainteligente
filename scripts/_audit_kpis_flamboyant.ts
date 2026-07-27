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

async function all<T extends Record<string, unknown>>(
  table: string,
  select: string,
  apply: (q: ReturnType<typeof sb.from>) => any,
): Promise<T[]> {
  const page = 1000;
  let from = 0;
  const rows: T[] = [];
  for (;;) {
    let q = sb.from(table).select(select).range(from, from + page - 1);
    q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data as T[]) || []));
    if (!data || data.length < page) break;
    from += page;
  }
  return rows;
}

function sum(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((s, r) => s + Number(r[key] || 0), 0);
}

async function main() {
  console.log('Consultando Supabase…');
  const compras = await all<Record<string, unknown>>(
    'contabilidad_compras',
    'id,monto_usd,honorarios_usd,origen,origen_v4_id,admin_pct_override',
    (q) => q.eq('proyecto_id', PID).neq('origen', 'HISTORICO_TABLA'),
  );
  const v4 = compras.filter((c) => c.origen === 'cco_v4_import' || c.origen_v4_id != null);
  const ings = await all<Record<string, unknown>>(
    'ci_inyecciones_capital',
    'id,monto_usd,origen_fondo,creado_por,banco_origen',
    (q) => q.eq('proyecto_id', PID),
  );
  const ingsV4 = ings.filter((i) => {
    const por = String(i.creado_por || '');
    const fondo = String(i.origen_fondo || '');
    const banco = String(i.banco_origen || '');
    return por === 'cco_v4_import' || fondo.includes('CCO-V4') || banco === 'CCO-V4';
  });

  const gNet = sum(v4, 'monto_usd');
  const gHon = sum(v4, 'honorarios_usd');
  const ingV4 = sum(ingsV4, 'monto_usd');
  const adminFlat = gNet * 0.15;
  const target = {
    ing: 625265,
    net: 565952.44,
    admin: 84892.87,
    costo: 650845.31,
    saldo: -25580.31,
  };

  const r = (n: number) => Math.round(n * 100) / 100;
  console.log(
    JSON.stringify(
      {
        compras_v4: v4.length,
        ingresos_v4: ingsV4.length,
        ingresos: r(ingV4),
        gastos_netos: r(gNet),
        admin_sum_honorarios_usd: r(gHon),
        admin_flat_15: r(adminFlat),
        costo_honorarios_col: r(gNet + gHon),
        costo_flat_15: r(gNet + adminFlat),
        saldo_honorarios_col: r(ingV4 - (gNet + gHon)),
        saldo_flat_15: r(ingV4 - (gNet + adminFlat)),
        target,
        diffs: {
          ingresos: r(ingV4 - target.ing),
          gastos_netos: r(gNet - target.net),
          admin_col: r(gHon - target.admin),
          admin_flat: r(adminFlat - target.admin),
          costo_col: r(gNet + gHon - target.costo),
          costo_flat: r(gNet + adminFlat - target.costo),
          saldo_col: r(ingV4 - (gNet + gHon) - target.saldo),
          saldo_flat: r(ingV4 - (gNet + adminFlat) - target.saldo),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
