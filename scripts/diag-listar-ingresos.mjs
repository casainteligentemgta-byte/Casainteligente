/**
 * Simula cargarIngresos contra Supabase (misma query que listarMovimientosInventario).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('compras_facturas')
  .select(
    `
    id,
    numero_factura,
    proveedor_nombre,
    fecha_emision,
    created_at,
    ubicacion_destino_id,
    lineas:compras_factura_lineas (
      id,
      cantidad,
      descripcion,
      material:global_inventory ( id, name, unit, sap_code )
    )
  `,
  )
  .eq('estado', 'registrada')
  .order('fecha_emision', { ascending: false })
  .limit(20);

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));

for (const fac of data ?? []) {
  const lineas = fac.lineas ?? [];
  console.log('\nFactura', fac.numero_factura, 'lineas:', lineas.length);
  for (const ln of lineas) {
    console.log('  ing-' + fac.id + '_' + ln.id, ln.descripcion ?? ln.material?.name);
  }
  if (!lineas.length) console.log('  ing-fac-' + fac.id, '(sin lineas)');
}
