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
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  return v;
};

const pid = process.argv[2] || '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

const c1 = await sb.from('capitulos').select('id', { count: 'exact', head: true }).eq('proyecto_id', pid);
const c2 = await sb.from('lulo_catalogo_capitulos').select('id', { count: 'exact', head: true });
const c3 = await sb
  .from('ci_presupuesto_partidas')
  .select('id', { count: 'exact', head: true })
  .eq('proyecto_id', pid);
const snap = await sb
  .from('ci_lulo_import_snapshots')
  .select('id, nombre_archivo, created_at')
  .eq('proyecto_id', pid)
  .order('created_at', { ascending: false })
  .limit(5);

console.log(
  JSON.stringify(
    {
      proyectoId: pid,
      capitulos: c1.count,
      capitulosErr: c1.error?.message,
      catalogoCapitulos: c2.count,
      ciPresupuestoPartidas: c3.count,
      snapshots: snap.data,
    },
    null,
    2,
  ),
);
