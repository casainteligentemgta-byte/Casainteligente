import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

/** Carga .env y luego .env.local (este gana). También corrige DATABASE_URL vacío en el entorno. */
function loadEnvFile(fileName: string, override: boolean) {
  const p = resolve(process.cwd(), fileName);
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    const empty = process.env[k] === undefined || process.env[k] === '';
    if (override || empty) process.env[k] = v;
  }
}
loadEnvFile('.env', false);
loadEnvFile('.env.local', true);

/** Requiere DATABASE_URL (PostgreSQL, ej. Supabase → Connection string → URI) */
export default defineConfig({
  schema: './lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
});
