import { NextResponse } from 'next/server';
import { asegurarUbicacionObra } from '@/lib/almacen/ubicacionesInventario';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * POST { proyecto_id, nombre? } → id de inv_ubicaciones tipo obra.
 * La RPC ci_asegurar_ubicacion_obra ya no tiene EXECUTE para authenticated/anon;
 * aquí se llama con service_role.
 */
export async function POST(req: Request) {
  const acceso = await requireAlgunPermisoWeb([
    'almacen.ingreso',
    'almacen.despacho',
    'almacen.cuarentena',
  ]);
  if (!acceso.ok) return acceso.response;

  let body: { proyecto_id?: string; nombre?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const proyectoId = String(body.proyecto_id ?? '').trim();
  const nombre = String(body.nombre ?? '').trim() || 'Obra';
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'proyecto_id inválido.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const id = await asegurarUbicacionObra(admin.client, proyectoId, nombre);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo asegurar ubicación de obra.';
    console.error('[POST /api/almacen/ubicaciones/asegurar-obra]', err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
