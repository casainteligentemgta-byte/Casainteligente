process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { cargarDashboardDesdeRegistrosGastos } from '../lib/contabilidad/cco/cargarDashboardDesdeRegistrosGastos';

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
  const dash = await cargarDashboardDesdeRegistrosGastos(sb, {
    proyectoId: PID,
    proyectoNombre: 'Flamboyant',
    proyectos: [],
    honorariosPct: 15,
    devaluacionPromedio: -25.6229,
  });
  console.log('devaluacionPromedio final:', dash.devaluacionPromedio);
  console.log('brechaFuente:', dash.brechaFuente);
  console.log('real:', dash.real);
}

main().catch(console.error);