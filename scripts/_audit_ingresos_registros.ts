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

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('registros_gastos')
      .select('clase,monto_base_usd,costo_total,monto_orig,moneda,tasa,tasa_binance,descripcion,fecha')
      .eq('proyecto_id', PID)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data as Record<string, unknown>[]) || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  function derivedBase(r: Record<string, unknown>): number {
    const moneda = String(r.moneda ?? 'USD').trim().toUpperCase();
    const orig = Number(r.monto_orig) || 0;
    const tasa = Number(r.tasa) || 0;
    const stored = Number(r.monto_base_usd) || 0;
    if (moneda && moneda !== 'USD' && orig > 0 && tasa > 0) {
      return orig / tasa;
    }
    return stored || orig;
  }

  function ingresoReal(r: Record<string, unknown>): number {
    const moneda = String(r.moneda ?? 'USD').trim().toUpperCase();
    const orig = Number(r.monto_orig) || 0;
    if (!moneda || moneda === 'USD') return orig || Number(r.monto_base_usd) || 0;
    const tasaBin = Number(r.tasa_binance) || 0;
    const tasa = Number(r.tasa) || 0;
    const tasaReal = tasaBin > 0 ? tasaBin : tasa;
    if (tasaReal > 0) return orig / tasaReal;
    return orig;
  }

  let ingStored = 0;
  let ingDerived = 0;
  let ingReal = 0;
  let n = 0;
  const diffs: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (String(r.clase).toUpperCase() !== 'INGRESO') continue;
    n += 1;
    const stored = Number(r.monto_base_usd) || 0;
    const derived = derivedBase(r);
    const real = ingresoReal(r);
    ingStored += stored;
    ingDerived += derived;
    ingReal += real;
    if (Math.abs(stored - derived) > 0.01) {
      diffs.push({
        desc: r.descripcion,
        moneda: r.moneda,
        stored: r2(stored),
        derived: r2(derived),
        orig: r.monto_orig,
        tasa: r.tasa,
      });
    }
  }

  const { data: cfg } = await sb
    .from('cco_proyecto_config')
    .select('metadata')
    .eq('proyecto_id', PID)
    .maybeSingle();

  console.log(
    JSON.stringify(
      {
        totalRows: rows.length,
        ingresosCount: n,
        sumStoredMontoBaseUsd: r2(ingStored),
        sumDerivedFromOrigTasa: r2(ingDerived),
        sumIngresoRealBinance: r2(ingReal),
        diffStoredVsDerived: r2(ingStored - ingDerived),
        rowsWithBaseMismatch: diffs.length,
        sampleDiffs: diffs.slice(0, 8),
        smallIngresos: rows
          .filter((r) => String(r.clase).toUpperCase() === 'INGRESO')
          .map((r) => ({
            desc: r.descripcion,
            base: r.monto_base_usd,
            orig: r.monto_orig,
            moneda: r.moneda,
          }))
          .filter((r) => Number(r.base) > 0 && Number(r.base) < 100),
        csvMetadata: (cfg as { metadata?: unknown } | null)?.metadata ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch(console.error);
