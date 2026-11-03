import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { buscarClientesParecidos } from '@/lib/clientes/duplicadosCliente';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/clientes/duplicados
 * Busca en todo el CRM (service_role) para no duplicar un cliente de otra empresa.
 */
export async function GET(req: Request) {
  const acceso = await requirePermisoWeb('clientes.editar');
  if (!acceso.ok) return acceso.response;

  const url = new URL(req.url);
  const rif = url.searchParams.get('rif');
  const cedula = url.searchParams.get('cedula');
  const telefono = url.searchParams.get('telefono');
  const excludeId = url.searchParams.get('excludeId');

  const busqueda = createSupabaseAdminOnlyClient() ?? acceso.supabase;
  const r = await buscarClientesParecidos(busqueda, { rif, cedula, telefono, excludeId });
  if (r.error) {
    return NextResponse.json({ error: r.error, parecidos: [] }, { status: 400 });
  }
  return NextResponse.json({ ok: true, parecidos: r.parecidos });
}
