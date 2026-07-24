/**
 * Diagnóstico búsqueda/corrección material (ej. cabiya → CABILLA).
 * Uso: npx tsx scripts/diag-correccion-material.ts [termino]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { buscarMaterialesInteligenteCatalogo } from '../lib/almacen/buscarMaterialesCatalogo';
import { buscarCorreccionMaterialCatalogo, evaluarCoincidenciaMaterial } from '../lib/almacen/correccionMaterialCatalogo';
import { resolverEntidadIdCatalogo } from '../lib/almacen/catalogoEntidad';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
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

async function main() {
  const term = process.argv[2] ?? 'cabiya';
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Falta .env.local');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Faltan credenciales Supabase');
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: proyectos } = await sb
    .from('ci_proyectos')
    .select('id,nombre,entidad_id')
    .order('nombre')
    .limit(5);

  console.log('=== Proyectos muestra ===');
  for (const p of proyectos ?? []) {
    const proyectoId = String(p.id);
    const entidadId = await resolverEntidadIdCatalogo(sb, { proyectoId });
    console.log(`\nProyecto: ${p.nombre} (${proyectoId.slice(0, 8)}…) entidad=${entidadId?.slice(0, 8) ?? 'null'}`);

    const resultados = await buscarMaterialesInteligenteCatalogo(sb, term, {
      limit: 8,
      entidadId,
      proyectoId,
    });
    console.log(`Top resultados para "${term}":`);
    for (const r of resultados.slice(0, 8)) {
      const ev = evaluarCoincidenciaMaterial(term, r.material, r.score);
      console.log(
        `  [${r.score}] ${r.fuente} ${r.material.name.slice(0, 60)} | typo=${ev.esTypo} sim=${Math.round(ev.similitudPalabra)}`,
      );
    }

    const correccion = await buscarCorreccionMaterialCatalogo(sb, term, {
      limit: 8,
      entidadId,
      proyectoId,
    });
    console.log(
      correccion
        ? `CORRECCION: "${correccion.termino}" → ${correccion.candidato?.name ?? correccion.terminoCanonico} (soloOrtografia=${correccion.soloOrtografia}, score ${correccion.score})`
        : 'CORRECCION: null (no dispara prompt)',
    );

    const { count } = await sb
      .from('global_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('entidad_id', entidadId ?? '');
    console.log(`Materiales en catálogo entidad: ${count ?? '?'}`);

    const { data: cabillas } = await sb
      .from('global_inventory')
      .select('id,name,sap_code')
      .eq('entidad_id', entidadId ?? '')
      .ilike('name', '%cabill%')
      .limit(5);
    console.log('CABILLA en catálogo entidad:', (cabillas ?? []).map((m) => m.name).join(' | ') || '(ninguno)');

    const { data: globalCab } = await sb
      .from('global_inventory')
      .select('id,name,entidad_id')
      .ilike('name', '%cabill%')
      .limit(8);
    console.log(
      'CABILLA global (todas entidades):',
      (globalCab ?? []).map((m) => `${m.name} [${String(m.entidad_id ?? 'null').slice(0, 8)}]`).join(' | ') ||
        '(ninguno)',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
