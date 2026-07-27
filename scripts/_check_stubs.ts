process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  clasificarConceptoMaterial,
  parseCantidadDesdeDescripcion,
  esLineaStubV4
} from '../lib/contabilidad/cco/parseCantidadDesdeDescripcion';

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
  const rows: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('registros_gastos')
      .select('id,descripcion,monto_base_usd,fecha,proveedor')
      .eq('proyecto_id', PID)
      .eq('clase', 'GASTO')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  const stubsPendientes = [];
  for (const r of rows) {
    const desc = r.descripcion || '';
    const concepto = clasificarConceptoMaterial(desc);
    if (concepto === 'otro') continue;
    
    const qty = parseCantidadDesdeDescripcion(desc);
    const stub = esLineaStubV4(desc, qty);
    
    if (stub && (!qty || qty.confianza !== 'alta')) {
      stubsPendientes.push(r);
    }
  }

  console.log('Total stubs pendientes:', stubsPendientes.length);
  for (const r of stubsPendientes.slice(0, 15)) {
    console.log(`ID: ${r.id} | Desc: ${r.descripcion}`);
  }
}

main().catch(console.error);