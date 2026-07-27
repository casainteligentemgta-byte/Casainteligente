import fs from 'fs';
import path from 'path';
import { parseRegistrosGastosCsv } from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function applyDerived(row: Record<string, unknown>, adminDefault = 15) {
  const moneda = String(row.moneda ?? 'USD').trim().toUpperCase();
  const montoOrig = Number(row.monto_orig) || 0;
  const tasa = Number(row.tasa) || 0;
  let base = Number(row.monto_base_usd);
  if (!Number.isFinite(base) || base === 0) base = montoOrig;
  if (moneda && moneda !== 'USD' && montoOrig > 0 && tasa > 0) {
    base = montoOrig / tasa;
  }
  const clase = String(row.clase ?? '').toUpperCase();
  const pct = Number(row.porcentaje_admin) > 0 ? Number(row.porcentaje_admin) : adminDefault;
  let honorarios = 0;
  let costo = base;
  if (clase === 'GASTO') {
    honorarios = base * (pct / 100);
    costo = base + honorarios;
  }
  return { base: round2(base), honorarios: round2(honorarios), costo: round2(costo) };
}

const root = path.join(__dirname, '..');
const csvPath = path.join(root, 'tmp', 'RANCHO_20072026.csv');
const { rows } = parseRegistrosGastosCsv(fs.readFileSync(csvPath, 'utf8'), 'x');

let ingRaw = 0;
let ingRound = 0;
let ingDerived = 0;
for (const r of rows) {
  if (String(r.clase).toUpperCase() !== 'INGRESO') continue;
  const base = Number(r.monto_base_usd) || 0;
  ingRaw += base;
  ingRound += round2(base);
  ingDerived += applyDerived(r as Record<string, unknown>).base;
}

console.log({
  ingRaw,
  ingRound: round2(ingRound),
  ingDerived: round2(ingDerived),
});
