/**
 * Lista capítulos y partidas (cascada Lulo) por proyecto.
 * Uso: node scripts/list-capitulos-partidas.mjs [proyecto_uuid]
 */
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

const proyectoId = process.argv[2];
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

async function listForProject(pid, nombre) {
  const { data: caps, error: e1 } = await sb
    .from('capitulos')
    .select('id, codigo, nombre, presupuesto_lulo_id')
    .eq('proyecto_id', pid)
    .order('codigo');
  if (e1) {
    console.error('Error capitulos:', e1.message);
    return;
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`Proyecto: ${nombre} (${pid})`);
  console.log(`Capítulos: ${caps?.length ?? 0}`);
  console.log('='.repeat(72));

  if (!caps?.length) {
    console.log('  (sin capítulos)\n');
    return;
  }

  const capIds = caps.map((c) => c.id);
  const { data: partidas, error: e2 } = await sb
    .from('partidas')
    .select('id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada')
    .in('capitulo_id', capIds)
    .order('codigo');
  if (e2) {
    console.error('Error partidas:', e2.message);
    return;
  }

  const byCap = new Map();
  for (const p of partidas ?? []) {
    const list = byCap.get(p.capitulo_id) ?? [];
    list.push(p);
    byCap.set(p.capitulo_id, list);
  }

  for (const cap of caps) {
    const ps = byCap.get(cap.id) ?? [];
    console.log(`\n  [${cap.codigo}] ${cap.nombre}  (${ps.length} partidas)`);
    for (const p of ps.slice(0, 15)) {
      const desc = String(p.descripcion ?? '').slice(0, 55);
      console.log(
        `      · ${p.codigo}  ${p.unidad ?? 'UND'}  cant=${p.cantidad_presupuestada ?? 0}  ${desc}`,
      );
    }
    if (ps.length > 15) console.log(`      … y ${ps.length - 15} partidas más`);
  }
  console.log(`\nTotal partidas: ${partidas?.length ?? 0}\n`);
}

if (proyectoId) {
  const { data: p } = await sb
    .from('ci_proyectos')
    .select('nombre')
    .eq('id', proyectoId)
    .maybeSingle();
  await listForProject(proyectoId, p?.nombre ?? proyectoId);
} else {
  const { data: proyectos } = await sb
    .from('ci_proyectos')
    .select('id, nombre, codigo_lulo')
    .order('nombre');
  for (const pr of proyectos ?? []) {
    await listForProject(pr.id, `${pr.nombre} [${pr.codigo_lulo ?? '—'}]`);
  }
}
