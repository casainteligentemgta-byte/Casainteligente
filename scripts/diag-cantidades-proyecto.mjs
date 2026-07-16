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

const { data: caps } = await sb.from('capitulos').select('id').eq('proyecto_id', pid);
const capIds = (caps ?? []).map((c) => c.id);
let partidas = [];
for (let i = 0; i < capIds.length; i += 80) {
  const { data } = await sb
    .from('partidas')
    .select('id, codigo, cantidad_presupuestada')
    .in('capitulo_id', capIds.slice(i, i + 80));
  if (data?.length) partidas.push(...data);
}
const pIds = partidas.map((p) => p.id);
let apu = [];
for (let i = 0; i < pIds.length; i += 80) {
  const { data } = await sb
    .from('apu_items')
    .select('rendimiento')
    .in('partida_id', pIds.slice(i, i + 80));
  if (data?.length) apu.push(...data);
}

const sinCant = partidas.filter((p) => !(Number(p.cantidad_presupuestada) > 0)).length;
const sinRend = apu.filter((a) => !(Number(a.rendimiento) > 0)).length;
console.log(
  JSON.stringify(
    {
      proyectoId: pid,
      capitulos: capIds.length,
      partidas: partidas.length,
      partidasSinCantidad: sinCant,
      apuItems: apu.length,
      apuSinRendimiento: sinRend,
      muestraPartidas: partidas.slice(0, 5),
    },
    null,
    2,
  ),
);
