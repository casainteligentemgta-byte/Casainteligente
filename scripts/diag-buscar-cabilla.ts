import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { buscarMaterialesInteligenteCatalogo } from '../lib/almacen/buscarMaterialesCatalogo';
import { buscarCorreccionMaterialCatalogo } from '../lib/almacen/correccionMaterialCatalogo';

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
  const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: entidades } = await sb.from('ci_entidades').select('id,nombre').order('nombre');
  console.log('=== Materiales por entidad ===');
  for (const e of entidades ?? []) {
    const { count } = await sb
      .from('global_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('entidad_id', e.id);
    const { data: cab } = await sb
      .from('global_inventory')
      .select('name')
      .eq('entidad_id', e.id)
      .ilike('name', '%cabill%')
      .limit(3);
    console.log(
      `${e.nombre}: ${count ?? 0} mats`,
      cab?.length ? `| cabilla: ${cab.map((x) => x.name).join(', ')}` : '',
    );
  }

  const { data: flam } = await sb
    .from('ci_proyectos')
    .select('id,entidad_id')
    .ilike('nombre', '%FLAMBOYANT%')
    .maybeSingle();

  for (const term of ['arena', 'cabiya', 'cabilla']) {
    const r = await buscarMaterialesInteligenteCatalogo(sb, term, {
      limit: 5,
      entidadId: flam?.entidad_id,
      proyectoId: flam?.id,
    });
    const c = await buscarCorreccionMaterialCatalogo(sb, term, {
      limit: 8,
      entidadId: flam?.entidad_id,
      proyectoId: flam?.id,
    });
    console.log(`\n--- ${term} (Flamboyant) ---`);
    for (const x of r) console.log(` [${x.score}] ${x.fuente} ${x.material.name}`);
    console.log('CORRECCION:', c?.candidato?.name ?? 'null');
  }
}


main().catch(console.error);
