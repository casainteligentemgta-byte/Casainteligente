import { NextResponse } from 'next/server';
import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { etiquetaCliente } from '@/lib/clientes/etiquetaCliente';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'X-CI-Clientes-Route': 'v2-always-200',
} as const;

function json(data: unknown) {
  return NextResponse.json(data, { headers: API_HEADERS });
}

type Item = { id: string; label: string; rif: string };

/** Columnas base (migración 009); si `*` falla en PostgREST, este listado suele funcionar. */
const CUSTOMERS_SELECT_SAFE =
  'id,nombre,rif,email,movil,tipo,status,direccion,imagen,created_at,updated_at' as const;

async function fetchCustomerRows(client: SupabaseClient): Promise<{ data: unknown[] | null; errorMsg: string | null }> {
  const first = await client.from('customers').select('*').limit(2000);
  if (first.error) {
    const second = await client.from('customers').select(CUSTOMERS_SELECT_SAFE).limit(2000);
    if (second.error) {
      return {
        data: null,
        errorMsg: `${first.error.message} · reintento columnas: ${second.error.message}`,
      };
    }
    return { data: (second.data ?? []) as unknown[], errorMsg: null };
  }
  return { data: (first.data ?? []) as unknown[], errorMsg: null };
}

function mapRow(raw: unknown): Item | null {
  try {
    const row = raw as Record<string, unknown>;
    const idRaw = row.id;
    const id = typeof idRaw === 'string' ? idRaw : idRaw != null ? String(idRaw) : '';
    if (!id) return null;
    const rifRaw = row.rif;
    const rif = typeof rifRaw === 'string' ? rifRaw.trim() : '';
    return {
      id,
      label: etiquetaCliente(row),
      rif,
    };
  } catch {
    return null;
  }
}

/**
 * Lista de clientes para selects (service role). Nunca devuelve 500: si falla Supabase o el mapeo,
 * responde 200 con `items: []` y `hint`/`error` para que el fetch del navegador no dispare “Internal Server Error”.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    return json({
      items: [] as Item[],
      hint: 'Falta NEXT_PUBLIC_SUPABASE_URL.',
    });
  }

  const admin = supabaseAdminForRoute();

  try {
    let data: unknown[] | null = null;

    if (admin.ok) {
      const { data: rows, errorMsg } = await fetchCustomerRows(admin.client);
      if (errorMsg) {
        console.error('[api/proyectos/clientes]', errorMsg);
        return json({ items: [] as Item[], hint: errorMsg });
      }
      data = rows;
    } else {
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
      if (!anon) {
        return json({
          items: [] as Item[],
          hint:
            'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.local; hace falta al menos una para leer customers desde el servidor.',
        });
      }
      const anonClient = createSupabaseJsClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: rows, errorMsg } = await fetchCustomerRows(anonClient);
      if (errorMsg) {
        return json({
          items: [] as Item[],
          hint: `${errorMsg} · Opcional: SUPABASE_SERVICE_ROLE_KEY evita límites de RLS del rol anon en esta ruta.`,
        });
      }
      data = rows;
    }

    const items: Item[] = [];
    for (const raw of data ?? []) {
      const item = mapRow(raw);
      if (item) items.push(item);
    }

    const rawLen = data?.length ?? 0;
    if (items.length === 0) {
      const hint =
        rawLen > 0
          ? `Se leyeron ${rawLen} filas en customers pero ninguna produjo id/etiqueta válidos.`
          : 'La tabla public.customers no tiene filas. Los proyectos del módulo enlazan clientes del CRM: crea al menos uno en /clientes. La lista “Personas” (/personas) es otra tabla y no sustituye a customers.';
      return json({ items, hint });
    }

    return json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado';
    console.error('[api/proyectos/clientes]', e);
    return json({
      items: [] as Item[],
      hint: message,
    });
  }
}
