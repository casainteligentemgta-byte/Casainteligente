/**
 * Crea el proyecto PDVSA, presupuesto Lulo principal (576PDVS2) y opcionalmente importa CSV.
 *
 * Uso:
 *   node scripts/setup-proyecto-pdvsa.mjs
 *   node scripts/setup-proyecto-pdvsa.mjs --import --csv ./export_lulo_csv
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
const CODIGO_OBR = '576PDVS2';
const NOMBRE_PROYECTO = 'PDVSA';
const NOMBRE_PRESUPUESTO = '576 PDVSA - Urbanismo (Lulo)';

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const argv = process.argv.slice(2);
const doImport = argv.includes('--import');
const csvIdx = argv.findIndex((a) => a === '--csv');
const csvDir = csvIdx >= 0 && argv[csvIdx + 1] ? argv[csvIdx + 1] : './export_lulo_csv';

if (!fs.existsSync(envPath)) {
  console.error('❌ Falta .env.local');
  process.exit(1);
}
const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function findOrCreateProyecto() {
  const { data: byName } = await sb
    .from('ci_proyectos')
    .select('id, nombre, codigo_lulo')
    .ilike('nombre', NOMBRE_PROYECTO)
    .limit(1)
    .maybeSingle();

  if (byName?.id) {
    console.log(`✓ Proyecto existente: ${byName.nombre} (${byName.id})`);
    await sb
      .from('ci_proyectos')
      .update({
        codigo_lulo: CODIGO_OBR,
        nombre: NOMBRE_PROYECTO,
        nombre_proyecto: NOMBRE_PROYECTO,
        updated_at: new Date().toISOString(),
      })
      .eq('id', byName.id);
    return byName.id;
  }

  const { data: others } = await sb
    .from('ci_proyectos')
    .select('id, nombre')
    .eq('codigo_lulo', CODIGO_OBR);
  for (const o of others ?? []) {
    await sb.from('ci_proyectos').update({ codigo_lulo: null }).eq('id', o.id);
    console.log(`↪ codigo_lulo quitado de "${o.nombre}" (${o.id})`);
  }

  const { data: cust } = await sb.from('customers').select('id').limit(1).maybeSingle();
  if (!cust?.id) {
    console.error('❌ No hay clientes en customers.');
    process.exit(1);
  }

  const { data: ins, error } = await sb
    .from('ci_proyectos')
    .insert({
      nombre: NOMBRE_PROYECTO,
      nombre_proyecto: NOMBRE_PROYECTO,
      codigo_lulo: CODIGO_OBR,
      ubicacion_texto: 'Urbanización Yaima, Los Semerucos, Punto Fijo, Edo. Falcón',
      estado: 'ejecucion',
      porcentaje_admin: 15,
      porcentaje_utilidad: 10,
      customer_id: cust.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌', error.message);
    process.exit(1);
  }
  console.log(`✓ Proyecto creado: ${NOMBRE_PROYECTO} (${ins.id})`);
  return ins.id;
}

async function ensurePresupuesto(proyectoId) {
  const { data: existing } = await sb
    .from('ci_proyecto_presupuestos_lulo')
    .select('id, codigo_obr, nombre, es_principal')
    .eq('proyecto_id', proyectoId)
    .eq('codigo_obr', CODIGO_OBR)
    .maybeSingle();

  if (existing?.id) {
    await sb
      .from('ci_proyecto_presupuestos_lulo')
      .update({ es_principal: true, nombre: NOMBRE_PRESUPUESTO })
      .eq('id', existing.id);
    await sb
      .from('ci_proyecto_presupuestos_lulo')
      .update({ es_principal: false })
      .eq('proyecto_id', proyectoId)
      .neq('id', existing.id);
    console.log(`✓ Presupuesto Lulo: ${CODIGO_OBR} (${existing.id})`);
    return existing.id;
  }

  await sb
    .from('ci_proyecto_presupuestos_lulo')
    .update({ es_principal: false })
    .eq('proyecto_id', proyectoId);

  const { data: row, error } = await sb
    .from('ci_proyecto_presupuestos_lulo')
    .insert({
      proyecto_id: proyectoId,
      codigo_obr: CODIGO_OBR,
      nombre: NOMBRE_PRESUPUESTO,
      es_principal: true,
      orden: 0,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '42P01') {
      console.error('❌ Tabla ci_proyecto_presupuestos_lulo no existe. Ejecuta: npm run db:apply-lulo-telegram');
      process.exit(1);
    }
    console.error('❌', error.message);
    process.exit(1);
  }
  console.log(`✓ Presupuesto Lulo creado: ${CODIGO_OBR} (${row.id})`);
  return row.id;
}

async function ensureProyectosMirror(proyectoId) {
  const { data: ci } = await sb
    .from('ci_proyectos')
    .select('nombre, ubicacion_texto')
    .eq('id', proyectoId)
    .single();
  const { data: p } = await sb.from('proyectos').select('id').eq('id', proyectoId).maybeSingle();
  if (!p?.id && ci) {
    await sb.from('proyectos').insert({
      id: proyectoId,
      nombre: ci.nombre,
      ubicacion: ci.ubicacion_texto ?? '',
    });
    console.log('✓ Fila en proyectos (espejo) creada');
  }
}

const proyectoId = await findOrCreateProyecto();
await ensureProyectosMirror(proyectoId);
const presupuestoId = await ensurePresupuesto(proyectoId);

console.log('\n--- PDVSA listo ---');
console.log(`proyecto_id:     ${proyectoId}`);
console.log(`presupuesto_id:  ${presupuestoId}`);
console.log(`codigo_obr:      ${CODIGO_OBR}`);
console.log(`MDB referencia:  576PDVSA.MDB`);

if (doImport) {
  console.log('\n▶ Importando cascada desde CSV…');
  const r = spawnSync(
    'npx',
    [
      'tsx',
      'scripts/import-lulo-csv-supabase.ts',
      '--proyecto',
      proyectoId,
      '--modo',
      'cascada',
      '--csv',
      csvDir,
      '--codigo-obra',
      CODIGO_OBR,
      '--nombre-presupuesto',
      NOMBRE_PRESUPUESTO,
      '--reemplazar',
    ],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  process.exit(r.status ?? 1);
}

console.log('\nPara importar el MDB exportado:');
console.log(`  npm run mdb:export-csv -- ".\\576PDVSA.MDB" --out ./export_lulo_csv`);
console.log(
  `  npm run import:lulo-csv -- --proyecto ${proyectoId} --modo cascada --csv ./export_lulo_csv --codigo-obra ${CODIGO_OBR} --reemplazar`,
);
