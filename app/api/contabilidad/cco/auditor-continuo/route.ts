import { NextResponse } from 'next/server';
import { ejecutarAuditorContinuoCco } from '@/lib/contabilidad/cco/auditorContinuo';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST { proyecto_id?, notificar?, persistir? }
 * Ejecuta el auditor continuo CCO (tablas + contratos).
 * Por defecto: solo la obra indicada; si no hay proyecto_id, todas.
 */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    let body: {
      proyecto_id?: string;
      notificar?: boolean;
      persistir?: boolean;
      actor?: string;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    const result = await ejecutarAuditorContinuoCco(admin.client, {
      proyectoId: body.proyecto_id?.trim() || null,
      notificar: body.notificar !== false,
      persistir: body.persistir !== false,
      actor: body.actor?.trim() || 'cco_ui',
    });

    return NextResponse.json({ ...result, ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'No se pudo ejecutar el auditor CCO.';
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: /cco_|schema cache|269|275/i.test(message)
          ? 'Verifique migraciones CCO (269+) en Supabase.'
          : undefined,
      },
      { status: 500 },
    );
  }
}

/** GET ?proyecto= — misma revisión (útil para pruebas). */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const url = new URL(req.url);
    const proyectoId = url.searchParams.get('proyecto')?.trim() || null;
    const notificar = url.searchParams.get('notificar') !== '0';

    const result = await ejecutarAuditorContinuoCco(admin.client, {
      proyectoId,
      notificar,
      persistir: true,
      actor: 'cco_ui_get',
    });

    return NextResponse.json({ ...result, ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'No se pudo ejecutar el auditor CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
