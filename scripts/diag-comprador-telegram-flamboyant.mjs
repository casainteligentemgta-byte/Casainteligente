import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      let val = l.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [l.slice(0, i).trim(), val];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const flamboyantId = '171694ed-0ecb-4ec5-82f5-82b980cb261f';

const { data: ent } = await sb.from('ci_entidades').select('id,nombre').ilike('nombre', '%dimaquinas%');
console.log('Entidades DIMAQUINAS:', ent);

const { data: proy } = await sb
  .from('ci_proyectos')
  .select('id,nombre,entidad_id')
  .eq('id', flamboyantId)
  .maybeSingle();
console.log('Proyecto Flamboyant:', proy);

const { data: compradores } = await sb
  .from('ci_usuarios_sistema_telegram')
  .select('id,nombre,telegram_id,rol,proyecto_id,activo')
  .eq('activo', true)
  .in('rol', ['Comprador', 'Administrador'])
  .order('nombre');

console.log('\n=== ci_usuarios_sistema_telegram (Comprador/Admin activos) ===');
for (const u of compradores ?? []) {
  let proyNom = '— (todas las obras)';
  if (u.proyecto_id) {
    const { data: p } = await sb.from('ci_proyectos').select('nombre').eq('id', u.proyecto_id).maybeSingle();
    proyNom = p?.nombre ?? u.proyecto_id;
  }
  const fl = u.proyecto_id === flamboyantId || !u.proyecto_id ? ' ✓ cubre Flamboyant' : '';
  console.log(`- ${u.nombre} | rol=${u.rol} | telegram_id=${u.telegram_id} | obra=${proyNom}${fl}`);
}

const { data: wl } = await sb
  .from('ci_telegram_whitelist')
  .select('id,nombre,chat_id,cargo,proyecto_id,activo')
  .eq('activo', true)
  .order('nombre');

console.log('\n=== ci_telegram_whitelist (Comprador/compras) ===');
for (const w of wl ?? []) {
  const cargo = String(w.cargo ?? '').toLowerCase();
  if (!cargo.includes('comprador') && !cargo.includes('compras')) continue;
  let proyNom = '—';
  if (w.proyecto_id) {
    const { data: p } = await sb.from('ci_proyectos').select('nombre').eq('id', w.proyecto_id).maybeSingle();
    proyNom = p?.nombre ?? w.proyecto_id;
  }
  console.log(`- ${w.nombre} | chat_id=${w.chat_id} | cargo=${w.cargo} | obra=${proyNom}`);
}

const { data: nomina } = await sb
  .from('ci_proyecto_nomina')
  .select('id,nombre,rol,telegram_chat_id,activo')
  .eq('proyecto_id', flamboyantId)
  .eq('activo', true);

console.log('\n=== ci_proyecto_nomina Flamboyant (rol comprador) ===');
let foundNomina = false;
for (const n of nomina ?? []) {
  const rol = String(n.rol ?? '').toLowerCase();
  if (!rol.includes('comprador') && !rol.includes('compras')) continue;
  foundNomina = true;
  console.log(`- ${n.nombre} | rol=${n.rol} | telegram_chat_id=${n.telegram_chat_id ?? '—'}`);
}
if (!foundNomina) console.log('(ninguno con rol comprador/compras)');

console.log('\n=== Resumen ===');
const compradorFlamboyant =
  (compradores ?? []).filter((u) => u.rol === 'Comprador' && (!u.proyecto_id || u.proyecto_id === flamboyantId))
    .length ?? 0;
console.log(`Compradores rol Comprador que aplican a Flamboyant: ${compradorFlamboyant}`);

const neoId = 8684897057;
const { data: neoWl } = await sb
  .from('ci_telegram_whitelist')
  .select('nombre,chat_id,cargo,proyecto_id,activo')
  .eq('chat_id', neoId);
console.log('\nWhitelist chat_id Neo (8684897057):', neoWl?.length ? neoWl : '(no está en ci_telegram_whitelist)');

const { data: allWl } = await sb
  .from('ci_telegram_whitelist')
  .select('nombre,chat_id,cargo,activo')
  .eq('activo', true)
  .order('nombre');
console.log(`\nTotal whitelist activa: ${allWl?.length ?? 0}`);
for (const w of allWl ?? []) {
  console.log(`  · ${w.nombre} (${w.chat_id}) cargo=${w.cargo ?? '—'}`);
}
