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

const proyectoId = process.argv[2];
const codigo = process.argv[3] ?? '576PDVS2';
if (!proyectoId) {
  console.error('Uso: node scripts/set-codigo-lulo.mjs <uuid> [codigo_lulo]');
  process.exit(1);
}

const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

const { data, error } = await sb
  .from('ci_proyectos')
  .update({ codigo_lulo: codigo })
  .eq('id', proyectoId)
  .select('id, nombre, codigo_lulo')
  .single();

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log('✅ Actualizado:');
console.log(`   id: ${data.id}`);
console.log(`   nombre: ${data.nombre}`);
console.log(`   codigo_lulo: ${data.codigo_lulo}`);
