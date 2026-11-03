import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { coordsCliente, direccionCliente, etiquetaCliente } from '@/lib/clientes/etiquetaCliente';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'X-CI-Clientes-Route': 'v3-session-clientes-ver',
} as const;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: API_HEADERS });
}

type Item = {
  id: string;
  label: string;
  rif: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
};

const CUSTOMERS_SELECT =
  'id,nombre,apellido,razon_social,nombre_comercial,rif,email,movil,tipo,status,direccion,latitude,longitude,created_at,updated_at' as const;

const CUSTOMERS_SELECT_SAFE =
  'id,nombre,apellido,razon_social,rif,email,movil,tipo,status,direccion,created_at,updated_at' as const;

async function fetchCustomerRows(client: SupabaseClient): Promise<{ data: unknown[] | null; errorMsg: string | null }> {
  const first = await client.from('customers').select(CUSTOMERS_SELECT).limit(2000);
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
    const gps = coordsCliente(row);
    return {
      id,
      label: etiquetaCliente(row),
      rif,
      direccion: direccionCliente(row),
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Lista de clientes para selects. Usa el cliente de sesión (RLS), no service_role.
 */
export async function GET() {
  const acceso = await requirePermisoWeb('clientes.ver');
  if (!acceso.ok) return acceso.response;

  try {
    const { data: rows, errorMsg } = await fetchCustomerRows(acceso.supabase);
    if (errorMsg) {
      console.error('[api/proyectos/clientes]', errorMsg);
      return json({ items: [] as Item[], hint: errorMsg });
    }

    const items: Item[] = [];
    for (const raw of rows ?? []) {
      const item = mapRow(raw);
      if (item) items.push(item);
    }

    const rawLen = rows?.length ?? 0;
    if (items.length === 0) {
      const hint =
        rawLen > 0
          ? `Se leyeron ${rawLen} filas en customers pero ninguna produjo id/etiqueta válidos.`
          : 'La tabla public.customers no tiene filas. Los proyectos del módulo enlazan clientes del CRM: crea al menos uno en /clientes.';
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
