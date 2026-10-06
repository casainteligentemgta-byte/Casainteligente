/**
 * Carga Siemon agosto 2026 + Acceso-Alarma septiembre 2026 en public.products.
 * Preferible: pegar supabase/sql_editor_siemon_acceso_alarma_2026.sql en SQL Editor.
 *
 *   npx tsx scripts/cargar-lista-siemon-acceso-alarma-2026.ts
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');
const jsonFiles = [
  'data/productos/siemon-agosto-2026.json',
  'data/productos/acceso-alarma-septiembre-2026.json',
];

type Item = {
  marca: string;
  modelo: string;
  nombre: string;
  categoria: string;
  costo: number;
  estatus: string;
  descripcion: string;
};

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function looksPlaceholder(url: string, key: string): boolean {
  const u = url.toLowerCase();
  const k = key.toLowerCase();
  return (
    !url ||
    !key ||
    u.includes('example.supabase') ||
    k.includes('your-anon-key') ||
    k.includes('your-service') ||
    key.length < 40
  );
}

function clave(marca: string, modelo: string): string {
  return `${marca.trim().toLowerCase()}::${modelo.trim().toLowerCase()}`;
}

function esMismaMarca(rowMarca: string | null | undefined, marca: string): boolean {
  const m = (rowMarca ?? '').trim().toLowerCase();
  return m === '' || m === marca.trim().toLowerCase();
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('Falta .env.local. Use el SQL Editor con supabase/sql_editor_siemon_acceso_alarma_2026.sql');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '').trim();
  if (looksPlaceholder(url, key)) {
    console.error(
      [
        'Este entorno no tiene credenciales reales de Supabase.',
        'Pegue supabase/sql_editor_siemon_acceso_alarma_2026.sql en Supabase → SQL Editor → Run.',
      ].join('\n'),
    );
    process.exit(2);
  }

  const productos: Item[] = [];
  for (const rel of jsonFiles) {
    const catalogo = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) as { productos: Item[] };
    productos.push(...catalogo.productos);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: existentes, error: errSel } = await sb
    .from('products')
    .select('id, marca, modelo')
    .limit(8000);
  if (errSel) throw new Error(errSel.message);

  const byKey = new Map<string, number[]>();
  for (const row of existentes ?? []) {
    const modelo = String(row.modelo ?? '');
    if (!modelo.trim()) continue;
    const ids = byKey.get(clave(String(row.marca ?? ''), modelo)) ?? [];
    ids.push(Number(row.id));
    byKey.set(clave(String(row.marca ?? ''), modelo), ids);
    if (!(row.marca as string | null)?.trim()) {
      const k = clave('', modelo);
      const extra = byKey.get(k) ?? [];
      extra.push(Number(row.id));
      byKey.set(k, extra);
    }
  }

  let actualizados = 0;
  let insertados = 0;

  for (const p of productos) {
    const payload = {
      nombre: p.nombre,
      categoria: p.categoria,
      marca: p.marca,
      modelo: p.modelo,
      descripcion: p.descripcion,
      descripcion2: `Lista distribuidor 2026 · ${p.estatus}`,
      costo: p.costo,
      precio: p.costo,
      utilidad: 0,
    };
    const ids = [
      ...(byKey.get(clave(p.marca, p.modelo)) ?? []),
      ...(byKey.get(clave('', p.modelo)) ?? []),
    ].filter((id, i, arr) => arr.indexOf(id) === i);

    const matchIds = ids.filter((id) => {
      const row = (existentes ?? []).find((x) => Number(x.id) === id);
      return row && esMismaMarca(row.marca as string | null, p.marca);
    });

    if (matchIds.length > 0) {
      const { error } = await sb.from('products').update(payload).in('id', matchIds);
      if (error) throw new Error(`${p.marca} ${p.modelo}: ${error.message}`);
      actualizados += matchIds.length;
    } else {
      const { error } = await sb.from('products').insert({ ...payload, cantidad: 0 });
      if (error) throw new Error(`${p.marca} ${p.modelo}: ${error.message}`);
      insertados += 1;
    }
  }

  console.log(JSON.stringify({ sku: productos.length, actualizados, insertados }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
