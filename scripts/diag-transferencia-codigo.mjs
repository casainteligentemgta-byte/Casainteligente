/**
 * Diagnóstico de transferencia por código (ej. SAL-MQ08T02T).
 * Uso: node scripts/diag-transferencia-codigo.mjs SAL-MQ08T02T
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const codigo = (process.argv[2] || '').trim().toUpperCase();
if (!codigo) {
  console.error('Indique código: node scripts/diag-transferencia-codigo.mjs SAL-XXX');
  process.exit(1);
}

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  let trf = null;
  let trfErr = null;

  const exact = await supabase
    .from('transferencias_inventario')
    .select(
      `
      id, codigo, estado, tipo_movimiento, created_at, updated_at,
      despachado_at, recibido_at, observaciones, ci_proyecto_id,
      origen_ubicacion_id, destino_ubicacion_id
    `,
    )
    .eq('codigo', codigo)
    .maybeSingle();
  trf = exact.data;
  trfErr = exact.error;

  if (!trf) {
    const frag = codigo.replace(/^SAL-/, '');
    const partial = await supabase
      .from('transferencias_inventario')
      .select(
        'id, codigo, estado, tipo_movimiento, created_at, ci_proyecto_id, origen_ubicacion_id, destino_ubicacion_id',
      )
      .ilike('codigo', `%${frag}%`)
      .order('created_at', { ascending: false })
      .limit(5);
    if (partial.error) trfErr = partial.error;
    else if (partial.data?.length === 1) trf = partial.data[0];
    else if (partial.data?.length > 1) {
      console.log('Varias coincidencias parciales:');
      console.log(partial.data);
      process.exit(0);
    }
  }

  if (trfErr) {
    console.error('Error transferencia:', trfErr.message);
    process.exit(1);
  }
  if (!trf) {
    console.log('No se encontró transferencia con código', codigo);
    const { data: recientes } = await supabase
      .from('transferencias_inventario')
      .select('codigo, estado, tipo_movimiento, created_at')
      .ilike('codigo', 'SAL-%')
      .order('created_at', { ascending: false })
      .limit(8);
    console.log('\nÚltimas SAL- en BD:');
    console.log(recientes ?? []);
    process.exit(0);
  }

  const { data: ubOrigen } = await supabase
    .from('inv_ubicaciones')
    .select('id, nombre, tipo')
    .eq('id', trf.origen_ubicacion_id)
    .maybeSingle();
  const { data: ubDestino } = await supabase
    .from('inv_ubicaciones')
    .select('id, nombre, tipo')
    .eq('id', trf.destino_ubicacion_id)
    .maybeSingle();
  trf = { ...trf, origen: ubOrigen, destino: ubDestino };

  console.log('=== Transferencia ===');
  console.log(JSON.stringify(trf, null, 2));

  const { data: lineas } = await supabase
    .from('transferencias_inventario_lineas')
    .select('id, material_id, cantidad, material:global_inventory ( name, unit )')
    .eq('transferencia_id', trf.id);

  console.log('\n=== Líneas ===');
  for (const ln of lineas ?? []) {
    const mat = Array.isArray(ln.material) ? ln.material[0] : ln.material;
    console.log(`- ${mat?.name ?? ln.material_id}: ${ln.cantidad} ${mat?.unit ?? ''}`);
  }

  const origenId = trf.origen?.id ?? null;
  const destinoId = trf.destino?.id ?? null;

  for (const ln of lineas ?? []) {
    const mid = ln.material_id;
    const mat = Array.isArray(ln.material) ? ln.material[0] : ln.material;
    const nombre = mat?.name ?? mid;

    if (origenId) {
      const { data: sOrig } = await supabase
        .from('inventario_stock')
        .select('cantidad_disponible, cantidad_en_transito_entrante')
        .eq('ubicacion_id', origenId)
        .eq('material_id', mid)
        .maybeSingle();
      console.log(`\nStock ORIGEN (${trf.origen?.nombre}) — ${nombre}:`, sOrig ?? 'sin fila');
    }
    if (destinoId) {
      const { data: sDest } = await supabase
        .from('inventario_stock')
        .select('cantidad_disponible, cantidad_en_transito_entrante')
        .eq('ubicacion_id', destinoId)
        .eq('material_id', mid)
        .maybeSingle();
      console.log(`Stock DESTINO (${trf.destino?.nombre}, tipo ${trf.destino?.tipo}) — ${nombre}:`, sDest ?? 'sin fila');
    }
  }

  const { data: egreso } = await supabase
    .from('inv_egresos_campo')
    .select('id, stock_aplicado, fecha_egreso, obrero_nombre, created_at')
    .eq('transferencia_id', trf.id)
    .maybeSingle();

  console.log('\n=== Egreso campo vinculado ===');
  console.log(egreso ?? 'ninguno');

  if (trf.ci_proyecto_id && lineas?.[0]?.material_id) {
    const { data: rpc } = await supabase.rpc('get_stock_real_obra', {
      p_proyecto_id: trf.ci_proyecto_id,
      p_ubicacion_id: null,
      p_material_id: lineas[0].material_id,
      p_solo_con_stock: false,
    });
    console.log('\n=== RPC get_stock_real_obra (material línea 1) ===');
    for (const r of rpc ?? []) {
      console.log(
        `  ${r.ubicacion_nombre} [${r.ubicacion_tipo}]: disp=${r.cantidad_disponible}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
