import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { guardarPlantillaPorCodigo, obtenerPlantillaPorCodigo } from '@/lib/talento/plantillaContratoObreroRepo';

export const runtime = 'nodejs';

export async function GET(_req: Request, context: { params: { codigo: string } }) {
  const codigo = (context.params?.codigo ?? '').trim();
  if (!codigo) {
    return NextResponse.json({ error: 'codigo requerido' }, { status: 400 });
  }
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  try {
    const row = await obtenerPlantillaPorCodigo(admin.client, codigo);
    if (!row) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ plantilla: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: { codigo: string } }) {
  const codigo = (context.params?.codigo ?? '').trim();
  if (!codigo) {
    return NextResponse.json({ error: 'codigo requerido' }, { status: 400 });
  }
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  let body: { titulo?: string; descripcion?: string | null; cuerpo?: string; activo?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const patch: Parameters<typeof guardarPlantillaPorCodigo>[2] = {};
  if (body.titulo != null) patch.titulo = String(body.titulo).trim();
  if (body.descripcion !== undefined) patch.descripcion = body.descripcion == null ? null : String(body.descripcion).trim();
  if (body.cuerpo != null) patch.cuerpo = String(body.cuerpo);
  if (body.activo !== undefined) patch.activo = Boolean(body.activo);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }
  try {
    const updated = await guardarPlantillaPorCodigo(admin.client, codigo, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Plantilla no existe; ejecute migración 093 o abra GET /api/talento/documentos-plantillas' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, plantilla: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
