/**
 * Carga la lista instalador Ezviz octubre 2026 en public.products.
 * Preferible: pegar supabase/sql_editor_ezviz_instalador_octubre_2026.sql en SQL Editor.
 *
 * Uso (si hay service_role real en .env.local):
 *   npx tsx scripts/cargar-lista-ezviz-octubre-2026.ts
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'data/productos/ezviz-instalador-octubre-2026.json');
const envPath = path.join(root, '.env.local');

type Catalogo = {
  fuente: string;
  productos: Array<{
    modelo: string;
    nombre: string;
    categoria: string;
    costo: number;
    estatus: string;
    descripcion: string;
  }>;
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

function claveModelo(modelo: string): string {
  return modelo.trim().toLowerCase();
}

function esEzviz(marca: string | null | undefined): boolean {
  const m = (marca ?? '').trim().toLowerCase();
  return m === '' || m === 'ezviz';
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('Falta .env.local. Use el SQL Editor con supabase/sql_editor_ezviz_instalador_octubre_2026.sql');
    process.exit(1);
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '').trim();
  if (looksPlaceholder(url, key)) {
    console.error(
      [
        'Este entorno no tiene credenciales reales de Supabase.',
        'Pegue supabase/sql_editor_ezviz_instalador_octubre_2026.sql en Supabase → SQL Editor → Run.',
      ].join('\n'),
    );
    process.exit(2);
  }

  const catalogo = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Catalogo;
  const productos = catalogo.productos;
  if (!Array.isArray(productos) || productos.length === 0) {
    throw new Error('Catálogo vacío');
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: existentes, error: errSel } = await sb
    .from('products')
    .select('id, marca, modelo')
    .limit(8000);
  if (errSel) throw new Error(errSel.message);

  const byModelo = new Map<string, number[]>();
  for (const row of existentes ?? []) {
    if (!esEzviz(row.marca as string | null)) continue;
    const k = claveModelo(String(row.modelo ?? ''));
    if (!k) continue;
    const ids = byModelo.get(k) ?? [];
    ids.push(Number(row.id));
    byModelo.set(k, ids);
  }

  let actualizados = 0;
  let insertados = 0;

  for (const p of productos) {
    const nota = `Lista instalador Ezviz Octubre 2026 · ${p.estatus}`;
    const payload = {
      nombre: p.nombre,
      categoria: p.categoria,
      marca: 'Ezviz',
      modelo: p.modelo,
      descripcion: p.descripcion,
      descripcion2: nota,
      costo: p.costo,
      precio: p.costo,
      utilidad: 0,
    };
    const ids = byModelo.get(claveModelo(p.modelo)) ?? [];
    if (ids.length > 0) {
      const { error } = await sb.from('products').update(payload).in('id', ids);
      if (error) throw new Error(`${p.modelo}: ${error.message}`);
      actualizados += ids.length;
    } else {
      const { error } = await sb.from('products').insert({ ...payload, cantidad: 0 });
      if (error) throw new Error(`${p.modelo}: ${error.message}`);
      insertados += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        fuente: catalogo.fuente,
        sku_catalogo: productos.length,
        actualizados,
        insertados,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
