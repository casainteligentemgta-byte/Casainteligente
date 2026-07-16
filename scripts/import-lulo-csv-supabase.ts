/**
 * Importa CSV exportados de LuloWin (migracion_*.csv) a Supabase.
 *
 * Uso:
 *   npx tsx scripts/import-lulo-csv-supabase.ts --proyecto <uuid> --csv ./export_lulo_csv
 *   npm run import:lulo-csv -- --proyecto <uuid> [--reemplazar] [--codigo-obra 576PDVS2] [--modo cascada]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAndNormalizeLuloCsvFolder } from '@/lib/proyectos/loadLuloCsvFolder';
import {
  parseAndValidateLuloMdbCascada,
  contarLuloMdbCascada,
} from '@/lib/proyectos/parseLuloMdbCascada';
import { parseLuloMdbEstructurado } from '@/lib/proyectos/parseLuloMdbEstructurado';
import { persistirLuloMdbCascada } from '@/lib/proyectos/persistirLuloMdbCascada';
import { persistirLuloEstructurado } from '@/lib/proyectos/persistirLuloEstructurado';
import { persistirLuloCatalogoMaestro } from '@/lib/proyectos/persistirLuloCatalogoMaestro';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidProyectoUuid, mensajeProyectoIdInvalido } from '@/lib/proyectos/validarProyectoUuid';
import {
  asegurarPresupuestoLuloParaImport,
  obtenerPresupuestoPorCodigoObr,
} from '@/lib/proyectos/presupuestosLulo';

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
  const has = (flag: string) => argv.includes(flag);
  const csvIdx = argv.findIndex((a) => !a.startsWith('-') && (a.includes('/') || a.includes('\\')));
  return {
    proyectoId: get('--proyecto') ?? get('-p'),
    csvDir: get('--csv') ?? (csvIdx >= 0 ? argv[csvIdx] : './export_lulo_csv'),
    codigoObra: get('--codigo-obra') ?? get('--codigo_obra'),
    presupuestoLuloId: get('--presupuesto-lulo-id') ?? get('--presupuesto_lulo_id'),
    nombrePresupuesto: get('--nombre-presupuesto'),
    reemplazar: has('--reemplazar'),
    modo: (get('--modo') ?? 'cascada').toLowerCase() as
      | 'cascada'
      | 'estructurado'
      | 'catalogo',
    dryRun: has('--dry-run'),
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

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  const supabase = createSupabaseAdminOnlyClient();
  if (!supabase) {
    console.error(
      '❌ Falta NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local',
    );
    process.exit(1);
  }

  let proyectoId = args.proyectoId;
  if (args.modo !== 'catalogo') {
    proyectoId =
      (await resolverProyectoId(supabase, args.proyectoId, args.codigoObra)) ?? undefined;
    if (!proyectoId) {
      console.error(
        '❌ Indica --proyecto <uuid> o un --codigo-obra que exista en ci_proyectos.codigo_lulo.',
      );
      process.exit(1);
    }
    if (!args.proyectoId) {
      console.log(`🔗 Proyecto resuelto por codigo_lulo: ${proyectoId}`);
    }
  }

  console.log(`📂 Leyendo CSV en ${path.resolve(args.csvDir)}…`);
  const dump = loadAndNormalizeLuloCsvFolder(args.csvDir, {
    codigoObra: args.codigoObra,
  });
  const tablas = dump.tables.filter((t) => t.rows.length > 0).map((t) => `${t.name}(${t.rowCount})`);
  console.log(`   Tablas: ${tablas.slice(0, 20).join(', ')}${tablas.length > 20 ? '…' : ''}`);

  if (args.modo === 'catalogo') {
    const obraPart = dump.tables.find((t) => t.name === 'ObraPart');
    const pain = ['ObraPainMate', 'ObraPainMano', 'ObraPainEqui']
      .map((n) => dump.tables.find((t) => t.name === n)?.rowCount ?? 0)
      .reduce((a, b) => a + b, 0);
    console.log(
      `📋 Catálogo maestro: ObraCapi, insumos M/MO/E, ObraPart(${obraPart?.rowCount ?? 0}), APU diseño(${pain})`,
    );
    if (args.dryRun) {
      console.log('✓ dry-run: no se escribió en Supabase.');
      return;
    }
    const result = await persistirLuloCatalogoMaestro(supabase, dump, {
      reemplazar: args.reemplazar,
      codigoObra: args.codigoObra,
    });
    console.log('✅ Catálogo maestro (lulo_catalogo_*):');
    console.log(`   Capítulos: ${result.capitulos}`);
    console.log(`   Insumos: ${result.insumos}`);
    console.log(`   Partidas catálogo: ${result.partidas}`);
    console.log(`   Líneas APU diseño: ${result.partidaInsumos}`);
    return;
  }

  if (args.modo === 'estructurado') {
    const structured = parseLuloMdbEstructurado(dump, proyectoId!, {
      codigoObra: args.codigoObra,
    });
    if (!structured?.partidas.length) {
      console.error('❌ No se pudieron parsear partidas (revisa ObraApun / PARTIDAS).');
      process.exit(1);
    }
    console.log(
      `📋 Estructurado: ${structured.partidas.length} partidas, ${structured.insumos.length} insumos, ${structured.apu.length} líneas APU`,
    );
    console.log(`   Tablas usadas: ${JSON.stringify(structured.tablasUsadas)}`);
    if (args.dryRun) {
      console.log('✓ dry-run: no se escribió en Supabase.');
      return;
    }
    const result = await persistirLuloEstructurado(supabase, proyectoId!, structured, {
      reemplazar: args.reemplazar,
    });
    console.log('✅ Importación estructurada (ci_presupuesto_*):');
    console.log(`   Partidas: ${result.partidasInsertadas}`);
    console.log(`   Insumos: ${result.insumosUpserted}`);
    console.log(`   APU: ${result.apuInsertados}`);
    return;
  }

  const validacion = parseAndValidateLuloMdbCascada(dump, proyectoId!);
  if (!validacion.ok) {
    console.error('❌', validacion.errors.join(' '));
    if (validacion.hint) console.error('   ', validacion.hint);
    process.exit(1);
  }

  const conteos = contarLuloMdbCascada(validacion.model);
  console.log(
    `📋 Cascada: ${conteos.capitulos} capítulos, ${conteos.partidas} partidas, ${conteos.apuItems} ítems APU`,
  );
  console.log(`   Tablas usadas: ${JSON.stringify(validacion.model.tablasUsadas)}`);

  if (args.dryRun) {
    console.log('✓ dry-run: no se escribió en Supabase.');
    return;
  }

  let presupuestoLuloId = args.presupuestoLuloId?.trim();
  if (!presupuestoLuloId && args.codigoObra?.trim()) {
    const pres = await asegurarPresupuestoLuloParaImport(
      supabase,
      proyectoId!,
      args.codigoObra.trim(),
      args.nombrePresupuesto,
    );
    presupuestoLuloId = pres.id;
    console.log(`📦 Presupuesto Lulo: ${pres.codigo_obr} (${pres.id})`);
  } else if (presupuestoLuloId && args.codigoObra?.trim()) {
    const pres = await obtenerPresupuestoPorCodigoObr(
      supabase,
      proyectoId!,
      args.codigoObra.trim(),
    );
    if (pres && pres.id !== presupuestoLuloId) {
      console.warn('⚠️  --presupuesto-lulo-id no coincide con --codigo-obra; se usa el id indicado.');
    }
  }

  const result = await persistirLuloMdbCascada(supabase, proyectoId!, validacion.model, {
    reemplazar: args.reemplazar,
    presupuestoLuloId,
  });
  console.log('✅ Importación cascada (capítulos → partidas → apu_items):');
  console.log(`   Capítulos: ${result.capitulos}`);
  console.log(`   Partidas: ${result.partidas}`);
  console.log(`   APU: ${result.apuItems}`);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
