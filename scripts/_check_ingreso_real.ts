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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const PID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';

async function main() {
  const { data, error } = await sb
    .from('registros_gastos')
    .select('id,descripcion,monto_base_usd,monto_orig,moneda,tasa,tasa_binance')
    .eq('proyecto_id', PID)
    .eq('clase', 'INGRESO');
  if (error) throw error;

  let sumBase = 0;
  let sumReal = 0;
  for (const r of data || []) {
    const base = Number(r.monto_base_usd) || 0;
    sumBase += base;
    
    const moneda = String(r.moneda ?? '').trim().toUpperCase();
    const montoOrig = Number(r.monto_orig) || 0;
    let ingresoReal = montoOrig;
    
    if (moneda === 'USD' || moneda === '') {
      // In python: return monto_orig
      // BUT what if monto_orig is 0 and monto_base_usd is not?
      if (montoOrig === 0 && base > 0) {
        console.log('WARNING: USD ingreso with monto_orig=0', r);
      }
    } else {
      const tasaBin = Number(r.tasa_binance) || 0;
      const tasa = Number(r.tasa) || 0;
      const tasaReal = tasaBin > 0 ? tasaBin : tasa;
      if (tasaReal > 0) ingresoReal = montoOrig / tasaReal;
    }
    sumReal += ingresoReal;
  }
  
  console.log('sumBase:', sumBase);
  console.log('sumReal:', sumReal);
  console.log('factor:', sumReal / sumBase);
  console.log('deval:', (sumReal / sumBase - 1) * 100);
}

main().catch(console.error);