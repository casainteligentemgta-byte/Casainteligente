import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'));
  if (!m) return '';
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
};

const codigo = process.argv[2] ?? '576PDVS2';
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

const { data: existing } = await sb
  .from('ci_proyectos')
  .select('id, nombre, codigo_lulo')
  .eq('codigo_lulo', codigo)
  .maybeSingle();

if (existing?.id) {
  console.log(existing.id);
  process.exit(0);
}

const { data: cust } = await sb.from('customers').select('id').limit(1).maybeSingle();
const customerId = cust?.id ?? null;
if (!customerId) {
  console.error('No hay clientes en customers; crea uno o asigna codigo_lulo manualmente.');
  process.exit(1);
}

const { data: ins, error } = await sb
  .from('ci_proyectos')
  .insert({
    nombre: '576 PDVSA - Urbanismo (Lulo)',
    nombre_proyecto: '576 PDVSA - Urbanismo (Lulo)',
    codigo_lulo: codigo,
    ubicacion_texto: 'Urbanización Yaima, Los Semerucos, Punto Fijo, Edo. Falcón',
    estado: 'ejecucion',
    porcentaje_admin: 15,
    porcentaje_utilidad: 10,
    customer_id: customerId,
  })
  .select('id')
  .single();

if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(ins.id);
