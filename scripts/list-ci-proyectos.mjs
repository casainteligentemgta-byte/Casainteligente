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

const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));
const { data, error } = await sb
  .from('ci_proyectos')
  .select('id, nombre, codigo_lulo')
  .order('nombre');
if (error) {
  console.error(error.message);
  process.exit(1);
}
for (const p of data ?? []) {
  console.log(`${p.id}  |  codigo_lulo=${p.codigo_lulo ?? '(null)'}  |  ${p.nombre}`);
}
