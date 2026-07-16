import fs from 'fs';
import { extractFullLuloMdb } from '@/lib/proyectos/extractLuloFull';

const mdb = process.argv[2]!;
const buf = fs.readFileSync(mdb);
const d = extractFullLuloMdb(buf);
const obraPart = d.tables.find((t) => t.name === 'ObraPart')!;
const capiPart = d.tables.find((t) => t.name === 'ObraCapiPart')!;
const apun = d.tables.find((t) => t.name === 'ObraApun')!;

const flPart = obraPart.rows.filter((r) => String(r.CodObr ?? '').includes('FLAMBO'));
const capParFilled = flPart.filter((r) => {
  const c = String(r.CapPar ?? '').trim();
  return c && c !== ' ';
});
console.log('ObraPart FLAMBO', flPart.length, 'CapPar util', capParFilled.length);
if (capParFilled[0]) console.log('sample CapPar', capParFilled[0]);

const sinObr = capiPart.rows.filter((r) => !String(r.CodObr ?? '').trim() || String(r.CodObr).trim() === ' ');
console.log('ObraCapiPart CodObr vacio/espacio', sinObr.length, 'total', capiPart.rows.length);
if (sinObr[0]) console.log('sample', sinObr[0]);

const codSet = new Set(sinObr.map((r) => String(r.CodPar).toUpperCase()));
const apFl = apun.rows.filter((r) => String(r.CodObr) === 'FLAMBO1E');
const apCodes = new Set(apFl.map((r) => String(r.CodPar).toUpperCase()));
const allCapi = capiPart.rows;
const matchAll = allCapi.filter((r) => apCodes.has(String(r.CodPar).toUpperCase()));
console.log('Apun FLAMBO', apFl.length, 'match ALL CapiPart by CodPar', matchAll.length);
const obras = new Map<string, number>();
for (const r of capiPart.rows) {
  const o = String(r.CodObr ?? '(vacío)').trim() || '(vacío)';
  obras.set(o, (obras.get(o) ?? 0) + 1);
}
console.log('CodObr en CapiPart', [...obras.entries()].slice(0, 8));
