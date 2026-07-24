import fs from 'fs';
import { extractFullLuloMdb } from '@/lib/proyectos/extractLuloFull';

const mdb = process.argv[2];
if (!mdb) {
  console.error('Uso: npx tsx scripts/debug-obra-capi.ts <mdb>');
  process.exit(1);
}
const buf = fs.readFileSync(mdb);
const dump = extractFullLuloMdb(buf);
for (const name of ['ObraCapi', 'ObraCapiDesc', 'ObraCapiPart', 'ObraApun']) {
  const t = dump.tables.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!t) continue;
  console.log('\n===', t.name, 'cols:', t.columns.join(', '));
  for (const row of t.rows.slice(0, 8)) console.log(JSON.stringify(row));
}
