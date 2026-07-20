/**
 * Importa el CSV maestro desde una carpeta de OneDrive (sincronizada en el PC).
 *
 * Uso:
 *   npx tsx scripts/cco-import-onedrive.ts --dir "C:/Users/.../OneDrive/CCO" --proyecto-id <UUID>
 *   npm run cco:import-onedrive -- --dir "..." --proyecto-id "..."
 *
 * Opcional:
 *   --file MAESTRO_....csv     (si no, toma el .csv más reciente que parezca maestro)
 *   --dry-run                  (parsea y muestra resumen, no escribe)
 *   --watch 60                 (reintenta cada N segundos si hay archivo nuevo)
 *   --honorarios 15
 *
 * Requiere .env.local: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Opcional: CCO_ONEDRIVE_DIR, CCO_PROYECTO_ID
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  esCsvMaestroCco,
  parseCsvMaestroV4,
} from '../lib/contabilidad/cco/parseCsvMaestroV4';
import { importarMaestroV4 } from '../lib/contabilidad/cco/importarMaestroV4';
import { mensajeAdvertenciaIds } from '../lib/contabilidad/cco/onedriveImportChecklist';
import { crearSnapshotCco } from '../lib/contabilidad/cco/snapshots';

const root = path.join(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1]!.trim();
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = v;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--')) {
    return process.argv[i + 1];
  }
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function listCandidateCsv(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`No existe la carpeta: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((n) => /\.(csv|tsv|txt)$/i.test(n))
    .map((n) => path.join(dir, n))
    .filter((p) => fs.statSync(p).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function pickMaestroFile(dir: string, explicit?: string): string {
  if (explicit) {
    const p = path.isAbsolute(explicit) ? explicit : path.join(dir, explicit);
    if (!fs.existsSync(p)) throw new Error(`No existe el archivo: ${p}`);
    return p;
  }
  const files = listCandidateCsv(dir);
  for (const f of files) {
    const head = fs.readFileSync(f, 'utf8').slice(0, 8000);
    if (esCsvMaestroCco(head) || /maestro/i.test(path.basename(f))) {
      return f;
    }
  }
  if (files[0]) return files[0];
  throw new Error(`No hay CSV en ${dir}`);
}

const statePath = path.join(root, 'tmp', 'cco-onedrive-last-import.json');

function readLastImport(): { file?: string; mtimeMs?: number; at?: string } {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as {
      file?: string;
      mtimeMs?: number;
      at?: string;
    };
  } catch {
    return {};
  }
}

function writeLastImport(file: string, mtimeMs: number) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(
    statePath,
    JSON.stringify({ file, mtimeMs, at: new Date().toISOString() }, null, 2),
  );
}

async function importOnce(opts: {
  dir: string;
  proyectoId: string;
  file?: string;
  dryRun: boolean;
  honorarios: number;
  force: boolean;
}): Promise<number> {
  const filePath = pickMaestroFile(opts.dir, opts.file);
  const st = fs.statSync(filePath);
  const last = readLastImport();

  if (
    !opts.force &&
    last.file === filePath &&
    last.mtimeMs === st.mtimeMs &&
    !opts.dryRun
  ) {
    console.log('Sin cambios (mismo archivo/mtime). Use --force para reimportar.');
    return 0;
  }

  console.log('Archivo:', filePath);
  console.log('Modificado:', st.mtime.toISOString());

  const text = fs.readFileSync(filePath, 'utf8');
  if (!esCsvMaestroCco(text)) {
    throw new Error('El archivo no parece CSV maestro CCO (falta columna CLASE).');
  }

  const parsed = parseCsvMaestroV4(text, {
    proyecto_id: opts.proyectoId,
    honorarios_admin_pct: opts.honorarios,
    obra_alias: `${path.basename(filePath)} / OneDrive`,
  });

  const warn = mensajeAdvertenciaIds(
    parsed.resumen.conIdExplicit,
    parsed.resumen.total,
  );
  console.log('Resumen:', JSON.stringify(parsed.resumen));
  console.log('Devaluación config:', parsed.devaluacion_pct);
  if (warn) {
    console.warn('ADVERTENCIA:', warn);
    if (parsed.resumen.conIdExplicit <= 0 && !hasFlag('allow-no-id')) {
      throw new Error(
        'Abortado: CSV sin IDs. Reexporte con columna ID o pase --allow-no-id (no recomendado).',
      );
    }
  }

  if (opts.dryRun) {
    console.log('Dry-run: no se escribió en Supabase.');
    return 0;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const pre = await crearSnapshotCco(sb, {
    proyectoId: opts.proyectoId,
    motivo: 'pre_import',
    label: `Antes de OneDrive ${path.basename(filePath)}`,
  });
  if (pre.ok) console.log('Snapshot previo:', pre.snapshot.id);
  else console.warn('Snapshot no creado:', pre.error);

  const { resumen: _r, ...payload } = parsed;
  const t0 = Date.now();
  const result = await importarMaestroV4(sb, {
    ...payload,
    proyecto_id: opts.proyectoId,
    auto_vincular: true,
  });
  console.log('ms', Date.now() - t0);
  console.log(JSON.stringify(result, null, 2));

  await sb.from('cco_auditoria_eventos').insert({
    proyecto_id: opts.proyectoId,
    accion: 'IMPORTACION CSV ONEDRIVE',
    detalle: `script · ${path.basename(filePath)} · gastos +${result.gastos.created}/~${result.gastos.updated}`,
    actor: 'cco_onedrive_script',
    metadata: {
      file: filePath,
      ...(result as unknown as Record<string, unknown>),
      pre_snapshot_id: pre.ok ? pre.snapshot.id : null,
    },
  });

  writeLastImport(filePath, st.mtimeMs);
  return result.errores?.length ? 1 : 0;
}

async function main() {
  loadEnvLocal();
  if (process.env.SUPABASE_DEV_INSECURE_TLS === '1') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const dir =
    arg('dir') ||
    process.env.CCO_ONEDRIVE_DIR ||
    '';
  const proyectoId =
    arg('proyecto-id') ||
    process.env.CCO_PROYECTO_ID ||
    '';
  if (!dir || !proyectoId) {
    console.error(`Uso:
  npx tsx scripts/cco-import-onedrive.ts --dir "<carpeta OneDrive>" --proyecto-id <UUID>

Env opcionales: CCO_ONEDRIVE_DIR, CCO_PROYECTO_ID
Flags: --file nombre.csv · --dry-run · --force · --watch 60 · --allow-no-id · --honorarios 15`);
    process.exit(1);
  }

  const opts = {
    dir,
    proyectoId,
    file: arg('file'),
    dryRun: hasFlag('dry-run'),
    honorarios: Number(arg('honorarios') || 15) || 15,
    force: hasFlag('force'),
  };

  const watchSec = Number(arg('watch') || 0);
  if (watchSec > 0) {
    console.log(`Modo watch cada ${watchSec}s → ${dir}`);
    for (;;) {
      try {
        await importOnce(opts);
      } catch (e) {
        console.error(e instanceof Error ? e.message : e);
      }
      await new Promise((r) => setTimeout(r, watchSec * 1000));
    }
  }

  const code = await importOnce(opts);
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
