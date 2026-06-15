import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { scoreMaterialInteligente } from '../lib/almacen/scoreMaterialInteligente';
import { evaluarCoincidenciaMaterial } from '../lib/almacen/correccionMaterialCatalogo';
import { normalizarTextoMaterial } from '../lib/almacen/normalizarTextoMaterial';

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
  const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
  const termNorm = normalizarTextoMaterial(term);

  const { data: mats } = await sb.from('global_inventory').select('id,name,sap_code,unit').order('name');
  const scored: Array<{ name: string; score: number; esTypo: boolean; sim: number }> = [];
  for (const row of mats ?? []) {
    const m = {
      id: String(row.id),
      name: String(row.name),
      sap_code: row.sap_code,
      unit: String(row.unit ?? 'UND'),
    };
    const score = scoreMaterialInteligente(termNorm, m);
    if (score < 62) continue;
    const ev = evaluarCoincidenciaMaterial(term, m, score);
    scored.push({ name: m.name, score, esTypo: ev.esTypo, sim: Math.round(ev.similitudPalabra) });
  }
  scored.sort((a, b) => b.score - a.score);
  console.log(`Scores para "${term}" (${mats?.length ?? 0} materiales en BD):`);
  for (const s of scored) {
    console.log(` [${s.score}] typo=${s.esTypo} sim=${s.sim} ${s.name}`);
  }
  if (!scored.length) console.log(' (ningún score >= 62)');
}

main().catch(console.error);
