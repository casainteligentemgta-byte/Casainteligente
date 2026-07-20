import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  importarMaestroV4,
  type CcoV4ImportPayload,
} from '@/lib/contabilidad/cco/importarMaestroV4';
import { crearSnapshotCco } from '@/lib/contabilidad/cco/snapshots';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST importa payload JSON exportado desde database_v4.db (script etl_cco_v4_sqlite.py).
 * Body: CcoV4ImportPayload { proyecto_id, transacciones[], estructura? }
 */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as CcoV4ImportPayload;
    if (!body?.proyecto_id || !Array.isArray(body.transacciones)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Body inválido: se requiere proyecto_id y transacciones[].',
          hint: 'Genera el JSON con: python scripts/etl_cco_v4_sqlite.py --out tmp/cco_v4.json',
        },
        { status: 400 },
      );
    }

    if (body.transacciones.length > 20000) {
      return NextResponse.json(
        { ok: false, error: 'Máximo 20.000 transacciones por import.' },
        { status: 400 },
      );
    }

    // Punto de seguridad antes de importar (si la migración 275 está aplicada)
    const esCsvOnedrive = /csv|onedrive/i.test(String(body.obra_alias ?? ''));
    const pre = await crearSnapshotCco(admin.client, {
      proyectoId: body.proyecto_id,
      motivo: 'pre_import',
      label: esCsvOnedrive
        ? 'Antes de importar CSV OneDrive'
        : 'Antes de importar V4 lite',
    });

    const result = await importarMaestroV4(admin.client, body);

    const db = admin.client as SupabaseClient;
    await db.from('cco_auditoria_eventos').insert({
      proyecto_id: body.proyecto_id,
      accion: esCsvOnedrive ? 'IMPORTACION CSV ONEDRIVE' : 'IMPORTACION V4 SQLITE',
      detalle: `gastos +${result.gastos.created}/~${result.gastos.updated} · contratos ${result.contratos} · ingresos ${result.ingresos}${
        pre.ok ? ` · snapshot previo ${pre.snapshot.id.slice(0, 8)}` : ''
      }`,
      metadata: {
        ...(result as unknown as Record<string, unknown>),
        fuente: esCsvOnedrive ? 'csv_onedrive' : 'json_v4',
        pre_snapshot_id: pre.ok ? pre.snapshot.id : null,
        pre_snapshot_error: pre.ok ? null : pre.error,
      },
    });

    return NextResponse.json({
      ...result,
      pre_snapshot_id: pre.ok ? pre.snapshot.id : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar CCO V4.';
    const hint = /cco_|tipo_gasto_cco|schema cache|42703/i.test(message)
      ? 'Ejecuta migraciones 268 + 269 (+ 275 snapshots) en Supabase.'
      : undefined;
    return NextResponse.json({ ok: false, error: message, hint }, { status: 500 });
  }
}
