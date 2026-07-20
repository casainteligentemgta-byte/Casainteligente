import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { restaurarSnapshotCco } from '@/lib/contabilidad/cco/snapshots';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id: string }> {
  return await Promise.resolve(params);
}

/** POST — restablece el libro CCO de la obra a este snapshot. */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { id } = await resolveParams(ctx.params);
    const snapshotId = String(id ?? '').trim();
    const body = (await req.json().catch(() => ({}))) as {
      proyecto_id?: string;
      confirmar?: boolean;
    };

    const proyectoId = String(body.proyecto_id ?? '').trim();
    if (!snapshotId || !proyectoId) {
      return NextResponse.json(
        { ok: false, error: 'proyecto_id y snapshot id son requeridos.' },
        { status: 400 },
      );
    }
    if (!body.confirmar) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Confirma la restauración enviando confirmar: true. Se creará un snapshot de seguridad antes.',
        },
        { status: 400 },
      );
    }

    const result = await restaurarSnapshotCco(admin.client as SupabaseClient, {
      snapshotId,
      proyectoId,
    });

    if (!result.ok && !result.pre_snapshot_id) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          hint: /275|migración/i.test(result.error ?? '')
            ? 'Ejecuta supabase/migrations/275_cco_snapshots_restauracion.sql'
            : undefined,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al restaurar snapshot CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
