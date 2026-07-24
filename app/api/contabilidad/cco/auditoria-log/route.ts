import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';

export const dynamic = 'force-dynamic';

/** POST log rápido de auditoría desde el cliente CCO. */
export async function POST(req: Request) {
  try {
    const accesoCco = await requireCcoAcceso('editar');
    if (!accesoCco.ok) return accesoCco.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as {
      proyecto_id?: string;
      accion?: string;
      detalle?: string;
      actor?: string;
    };

    const accion = String(body.accion ?? '').trim();
    if (!accion) {
      return NextResponse.json({ ok: false, error: 'accion requerida.' }, { status: 400 });
    }

    const db = admin.client as SupabaseClient;
    const { error } = await db.from('cco_auditoria_eventos').insert({
      proyecto_id: body.proyecto_id?.trim() || null,
      accion: accion.slice(0, 200),
      detalle: body.detalle?.slice(0, 2000) || null,
      actor: body.actor?.trim() || 'cco_ui',
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar auditoría.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
