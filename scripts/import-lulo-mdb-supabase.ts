/**
 * Reimporta presupuesto LuloWin (.mdb) a cascada Supabase (capítulos → partidas → apu_items).
 *
 * Uso:
 *   npx tsx scripts/import-lulo-mdb-supabase.ts --proyecto <uuid> --mdb ./FLAMBO1E.MDB --reemplazar
 *   npx tsx scripts/import-lulo-mdb-supabase.ts --codigo-obra FLAMBO1E --mdb "C:\\ruta\\FLAMBO1E.MDB" --reemplazar
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractFullLuloMdb } from '@/lib/proyectos/extractLuloFull';
import { importarLuloMdbDirecto } from '@/lib/proyectos/importarLuloMdbDirecto';
import { prepareLuloMdbDumpForParse } from '@/lib/proyectos/loadLuloCsvFolder';
import {
  contarLuloMdbCascada,
  parseAndValidateLuloMdbCascada,
} from '@/lib/proyectos/parseLuloMdbCascada';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import type { SupabaseClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined;
  };
  return {
    proyectoId: get('--proyecto') ?? get('-p'),
    mdb: get('--mdb') ?? get('-m'),
    codigoObra: get('--codigo-obra') ?? get('--codigo_obr'),
    reemplazar: argv.includes('--reemplazar'),
    dryRun: argv.includes('--dry-run'),
  };
}

async function resolverProyectoId(
  supabase: SupabaseClient,
  proyectoId: string | undefined,
  codigoObra: string | undefined,
): Promise<string | null> {
  if (proyectoId?.trim() && isValidProyectoUuid(proyectoId)) return proyectoId.trim();
  const cod = codigoObra?.trim();
  if (!cod) return null;
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id')
    .eq('codigo_lulo', cod)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

function diagnosticarCantidades(
  proyectoId: string,
  mdbPath: string,
  codigoObra: string | undefined,
) {
  const buffer = fs.readFileSync(mdbPath);
  const dump = extractFullLuloMdb(buffer);
  const prepared = prepareLuloMdbDumpForParse(dump, { codigoObra });
  const validacion = parseAndValidateLuloMdbCascada(prepared, proyectoId, { codigoObra });
  if (!validacion.ok) {
    console.warn('⚠️  Diagnóstico cantidades: parseo inválido.');
    return;
  }
  let partidasSinCant = 0;
  let partidasTotal = 0;
  let apuSinRend = 0;
  let apuTotal = 0;
  for (const cap of validacion.model.capitulos) {
    for (const p of cap.partidas) {
      partidasTotal += 1;
      if (!(Number(p.cantidad_presupuestada) > 0)) partidasSinCant += 1;
      for (const a of p.apu) {
        apuTotal += 1;
        if (!(Number(a.rendimiento) > 0)) apuSinRend += 1;
      }
    }
  }
  const conteos = contarLuloMdbCascada(validacion.model);
  console.log(
    `📊 Diagnóstico: ${conteos.capitulos} capítulos · ${conteos.partidas} partidas · ${conteos.apuItems} APU`,
  );
  console.log(
    `📊 Cantidades: partidas con cantidad>0: ${partidasTotal - partidasSinCant}/${partidasTotal} · APU con rendimiento>0: ${apuTotal - apuSinRend}/${apuTotal}`,
  );
  for (const cap of validacion.model.capitulos) {
    console.log(`   · Cap. ${cap.codigo}: ${cap.nombre.slice(0, 72)} (${cap.partidas.length} partidas)`);
  }
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  if (!args.mdb?.trim()) {
    console.error('❌ Indica --mdb <ruta al .mdb>');
    process.exit(1);
  }

  const mdbPath = path.resolve(args.mdb);
  if (!fs.existsSync(mdbPath)) {
    console.error(`❌ No existe el MDB: ${mdbPath}`);
    process.exit(1);
  }

  const supabase = createSupabaseAdminOnlyClient();
  if (!supabase) {
    console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
    process.exit(1);
  }

  const proyectoId = await resolverProyectoId(supabase, args.proyectoId, args.codigoObra);
  if (!proyectoId) {
    console.error('❌ Indica --proyecto <uuid> o --codigo-obra existente en ci_proyectos.');
    process.exit(1);
  }

  const codigoObra = args.codigoObra?.trim();
  console.log(`🔗 Proyecto: ${proyectoId}${codigoObra ? ` · CodObr: ${codigoObra}` : ''}`);
  console.log(`📂 MDB: ${mdbPath}`);
  console.log(`🔄 Reemplazar presupuesto previo: ${args.reemplazar ? 'sí' : 'no (añade sin borrar)'}`);

  diagnosticarCantidades(proyectoId, mdbPath, codigoObra);

  if (args.dryRun) {
    console.log('✓ dry-run: no se escribió en Supabase.');
    return;
  }

  const buffer = fs.readFileSync(mdbPath);
  const result = await importarLuloMdbDirecto(supabase, proyectoId, buffer, {
    reemplazar: args.reemplazar,
    nombreArchivo: path.basename(mdbPath),
    codigoObr: codigoObra,
  });

  if ('capitulos' in result) {
    console.log('✅ Reimportación cascada completada:');
    console.log(`   Capítulos: ${result.capitulos}`);
    console.log(`   Partidas: ${result.partidas}`);
    console.log(`   Ítems APU: ${result.apuItems}`);
    console.log(`   Tablas: ${JSON.stringify(result.tablasUsadas)}`);
  } else {
    console.log('✅ Importación presupuesto Lulo (multi-obra):', result);
  }
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
