import fs from 'fs';
import { extractFullLuloMdb } from '../lib/proyectos/extractLuloFull.ts';

const mdb = process.argv[2];
const buf = fs.readFileSync(mdb);
const dump = extractFullLuloMdb(buf);
for (const name of ['ObraCapi', 'ObraCapiDesc', 'ObraCapiPart', 'ObraApun']) {
  const t = dump.tables.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!t) continue;
  console.log('\n===', t.name, 'cols:', t.columns.join(', '));
  for (const row of t.rows.slice(0, 5)) console.log(row);
  const flam = t.rows.filter((r) => JSON.stringify(r).includes('FLAMBO'));
  console.log('rows FLAMBO1E filter sample:', flam.length, flam[0]);
}
