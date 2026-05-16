import { NextResponse } from 'next/server';
import { supabaseForRoute } from '@/lib/talento/supabase-route';
import { forceAceptarContrato } from '@/lib/talento/forceAceptarContrato';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: { id: string } }) {
  const id = context.params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Falta id de contrato' }, { status: 400 });
  }

  const sb = supabaseForRoute();
  if (!sb.ok) return sb.response;

  // Verificar que el usuario está autenticado
  const { data: { user } } = await sb.client.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { admin_id?: string; motivo?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const adminId = body.admin_id || user.id;
  const motivo = body.motivo || "Aceptación manual / Desatasco de flujo en pruebas";

  try {
    const { data, error } = await forceAceptarContrato(id, adminId, motivo);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
