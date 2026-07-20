import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registrarEventoAuditoriaCco } from '@/lib/contabilidad/cco/registrarAuditoria';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** POST log rápido de auditoría desde el cliente CCO. */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as {
      proyecto_id?: string;
      accion?: string;
      detalle?: string;
      actor?: string;
      metadata?: Record<string, unknown>;
    };

    const accion = String(body.accion ?? '').trim();
    if (!accion) {
      return NextResponse.json({ ok: false, error: 'accion requerida.' }, { status: 400 });
    }

    const db = admin.client as SupabaseClient;
    await registrarEventoAuditoriaCco(db, {
      proyecto_id: body.proyecto_id?.trim() || null,
      accion: accion.slice(0, 200),
      detalle: body.detalle?.slice(0, 4000) || null,
      actor: body.actor?.trim() || undefined,
      metadata: body.metadata ?? {},
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar auditoría.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
