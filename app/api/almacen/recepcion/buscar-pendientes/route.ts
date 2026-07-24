import { NextResponse } from 'next/server';
import { buscarRecepcionesCampoPendientes } from '@/lib/almacen/buscarRecepcionesCampoPendientes';
import { resolverProveedorIdPorRifNombre } from '@/lib/almacen/resolverProveedorIdCompra';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const proyectoId = url.searchParams.get('proyecto_id')?.trim() ?? '';
  let proveedorId = url.searchParams.get('proveedor_id')?.trim() ?? '';
  const proveedorNombre = url.searchParams.get('proveedor_nombre')?.trim() ?? '';
  const proveedorRif = url.searchParams.get('proveedor_rif')?.trim() ?? '';

  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'proyecto_id inválido.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  if (!proveedorId) {
    proveedorId =
      (await resolverProveedorIdPorRifNombre(admin.client, {
        rif: proveedorRif,
        nombre: proveedorNombre,
      })) ?? '';
  }

  if (!proveedorId && !proveedorNombre) {
    return NextResponse.json({ recepciones: [] });
  }

  try {
    const recepciones = await buscarRecepcionesCampoPendientes(admin.client, {
      proyectoId,
      proveedorId: proveedorId || null,
      proveedorNombre: proveedorId ? null : proveedorNombre,
    });
    return NextResponse.json({ recepciones });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al buscar recepciones';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
