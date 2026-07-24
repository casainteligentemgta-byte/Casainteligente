import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  crearSnapshotCco,
  listarSnapshotsCco,
  type CcoSnapshotMotivo,
} from '@/lib/contabilidad/cco/snapshots';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET ?proyecto= — lista puntos de restauración (sin payload). */
export async function GET(req: Request) {
  try {
    const accesoCco = await requireCcoAcceso('ver');
    if (!accesoCco.ok) return accesoCco.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const { snapshots, error } = await listarSnapshotsCco(admin.client, proyectoId);
    if (error) {
      return NextResponse.json(
        { ok: false, error, hint: 'Ejecuta migración 275 en Supabase SQL Editor.' },
        { status: /migración|275/i.test(error) ? 503 : 500 },
      );
    }
    return NextResponse.json({ ok: true, snapshots });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al listar snapshots CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** POST — crea snapshot manual (o con motivo). */
export async function POST(req: Request) {
  try {
    const accesoCco = await requireCcoAcceso('editar');
    if (!accesoCco.ok) return accesoCco.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as {
      proyecto_id?: string;
      label?: string;
      motivo?: CcoSnapshotMotivo;
    };
    const proyectoId = String(body.proyecto_id ?? '').trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'proyecto_id requerido.' }, { status: 400 });
    }

    const motivo = body.motivo === 'pre_import' ? 'pre_import' : 'manual';
    const result = await crearSnapshotCco(admin.client as SupabaseClient, {
      proyectoId,
      motivo,
      label: body.label ?? null,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          hint: /275|migración/i.test(result.error)
            ? 'Ejecuta supabase/migrations/275_cco_snapshots_restauracion.sql'
            : undefined,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, snapshot: result.snapshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al crear snapshot CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
