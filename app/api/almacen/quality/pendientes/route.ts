import { NextResponse } from 'next/server';
import { listarInspeccionesCuarentenaPendientes } from '@/lib/almacen/listarInspeccionesCuarentena';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
export const dynamic = 'force-dynamic';

/** Lista inspecciones PENDIENTE (service role; evita RLS en joins). */
export async function GET() {
  const acceso = await requireAlgunPermisoWeb(['almacen.ingreso', 'almacen.cuarentena', 'almacen.despacho', 'compra.registrar']);
  if (!acceso.ok) return acceso.response;

  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const rows = await listarInspeccionesCuarentenaPendientes(admin.client);
    return NextResponse.json({ items: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar cuarentena';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
