process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  clasificarConceptoMaterial,
  parseCantidadDesdeDescripcion,
  esLineaStubV4
} from '../lib/contabilidad/cco/parseCantidadDesdeDescripcion';

const root = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const PID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';

async function main() {
  const { data: compras, error: errC } = await sb
    .from('contabilidad_compras')
    .select('id,origen,notas,tipo_gasto_cco')
    .eq('proyecto_id', PID)
    .neq('origen', 'HISTORICO_TABLA');
  if (errC) throw errC;

  const compraIds = compras.map((c: any) => c.id);
  const compraById = new Map(compras.map((c: any) => [c.id, c]));

  const rows: any[] = [];
  for (let i = 0; i < compraIds.length; i += 100) {
    const chunk = compraIds.slice(i, i + 100);
    const { data, error } = await sb
      .from('contabilidad_compra_lineas')
      .select('id,compra_id,descripcion,cantidad,unidad')
      .in('compra_id', chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }

  const stubsPendientes = [];
  for (const l of rows) {
    const compra = compraById.get(l.compra_id);
    if (!compra) continue;

    const texto = `${l.descripcion ?? ''} ${compra.notas ?? ''}`.trim();
    const concepto = clasificarConceptoMaterial(texto);

    const tipo = String(compra.tipo_gasto_cco ?? '').toUpperCase();
    const esMateriales = tipo.includes('MATERIAL');
    if (concepto === 'otro' && !esMateriales) continue;

    const cantidadDb = Number(l.cantidad) || 0;
    const unidadDb = String(l.unidad ?? 'UND').trim() || 'UND';
    const origen = String(compra.origen ?? '');
    
    const stub = esLineaStubV4({
      cantidad: cantidadDb,
      unidad: unidadDb,
      origen
    });
    const parsed = parseCantidadDesdeDescripcion(texto);

    if (stub && !parsed) {
      stubsPendientes.push({ l, texto });
    }
  }

  console.log('Total stubs pendientes:', stubsPendientes.length);
  for (const r of stubsPendientes.slice(0, 79)) {
    console.log(`ID: ${r.l.id} | Desc: ${r.texto}`);
  }
}

main().catch(console.error);