process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  mapCsvRowToRegistrosGastos,
  parseRegistrosGastosCsv,
} from '../lib/contabilidad/cco/importCsvToRegistrosGastos';
import { applyDerivedCsvMontos, parseCsvMaestroRows, parseNumeroCsv } from '../lib/contabilidad/cco/parseCsvMaestro';

const root = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

function pick(row: Record<string, string>, name: string): string {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]));
  const k = lower.get(name.toLowerCase());
  return k ? (row[k] ?? '').trim() : '';
}

async function main() {
  const csvPath = path.join(root, 'tmp', 'RANCHO_20072026.csv');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const raw = parseCsvMaestroRows(csvText);

  let sumColBase = 0;
  let sumDerived = 0;
  let sumStored = 0;
  const diffs: { desc: string; col: number; derived: number; moneda: string; orig: number; tasa: number }[] = [];

  for (const r of raw) {
    if (String(pick(r, 'CLASE')).toUpperCase() !== 'INGRESO') continue;
    const colBase = parseNumeroCsv(pick(r, 'MONTO BASE USD')) ?? 0;
    const mapped = mapCsvRowToRegistrosGastos(r);
    if (!mapped) continue;
    const d = applyDerivedCsvMontos(mapped, 15);
    const derived = Number(d.monto_base_usd) || 0;
    sumColBase += colBase;
    sumDerived += derived;
    if (Math.abs(colBase - derived) > 0.01) {
      diffs.push({
        desc: pick(r, 'DESCRIPCION').slice(0, 40),
        col: colBase,
        derived,
        moneda: mapped.moneda ?? '',
        orig: Number(mapped.monto_orig) || 0,
        tasa: Number(mapped.tasa) || 0,
      });
    }
  }

  const PID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
  const { rows } = parseRegistrosGastosCsv(csvText, PID);
  for (const r of rows) {
    if (String(r.clase).toUpperCase() !== 'INGRESO') continue;
    sumStored += Number(r.monto_base_usd) || 0;
  }

  console.log({
    sumColBase: Math.round(sumColBase * 100) / 100,
    sumDerived: Math.round(sumDerived * 100) / 100,
    sumStored: Math.round(sumStored * 100) / 100,
    diffCount: diffs.length,
    diffs: diffs.slice(0, 10),
  });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await sb.from('registros_gastos').select('monto_base_usd').eq('proyecto_id', PID).eq('clase', 'INGRESO');
  const dbSum = (data || []).reduce((s, r) => s + (Number(r.monto_base_usd) || 0), 0);
  console.log('dbSum', Math.round(dbSum * 100) / 100, 'dbCount', data?.length);
}

main().catch(console.error);
