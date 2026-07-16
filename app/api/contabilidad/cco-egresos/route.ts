import { NextResponse } from 'next/server';
import {
  cargarCcoEgresos,
  crearEgresoManualCco,
  eliminarEgresoCco,
} from '@/lib/contabilidad/cargarCcoEgresos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET lista de egresos CCO + KPIs. */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto')?.trim() || null;
    const anioRaw = searchParams.get('anio');
    const mesRaw = searchParams.get('mes');
    const anio =
      anioRaw != null && anioRaw !== '' && Number.isFinite(Number(anioRaw))
        ? Number(anioRaw)
        : null;
    const mes =
      mesRaw != null && mesRaw !== '' && Number.isFinite(Number(mesRaw))
        ? Number(mesRaw)
        : null;

    const data = await cargarCcoEgresos(admin.client, { proyectoId, anio, mes });
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar egresos.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** POST carga manual de egreso (compra obra). */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as {
      proyectoId?: string;
      fecha?: string;
      rubro?: string;
      montoUsd?: number;
      descripcion?: string;
      proveedor?: string;
      factura?: string;
    };

    const created = await crearEgresoManualCco(admin.client, {
      proyectoId: String(body.proyectoId ?? ''),
      fecha: String(body.fecha ?? ''),
      rubro: String(body.rubro ?? 'MATERIALES'),
      montoUsd: Number(body.montoUsd),
      descripcion: String(body.descripcion ?? ''),
      proveedor: body.proveedor,
      factura: body.factura,
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo registrar el egreso.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/** DELETE egreso (compra). */
export async function DELETE(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim() || '';
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
    }

    await eliminarEgresoCco(admin.client, id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo eliminar el egreso.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
