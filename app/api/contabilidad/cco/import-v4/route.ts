import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  importarMaestroV4,
  type CcoV4ImportPayload,
} from '@/lib/contabilidad/cco/importarMaestroV4';
import { registrarEventoAuditoriaCco } from '@/lib/contabilidad/cco/registrarAuditoria';
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

    const result = await importarMaestroV4(admin.client, body);

    const db = admin.client as SupabaseClient;
    await registrarEventoAuditoriaCco(db, {
      proyecto_id: body.proyecto_id,
      accion: 'IMPORTACION V4 LITE',
      detalle: [
        `Importó V4 lite: ${body.transacciones.length} txs`,
        `gastos +${result.gastos?.created ?? 0} / ~${result.gastos?.updated ?? 0}`,
        `contratos ${result.contratos}`,
        `ingresos ${result.ingresos}`,
        `presupuestos ${result.presupuestos}`,
        `vinculados ${result.vinculados}`,
      ].join(' · '),
      metadata: result as unknown as Record<string, unknown>,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar CCO V4.';
    const hint = /cco_|tipo_gasto_cco|schema cache|42703/i.test(message)
      ? 'Ejecuta migraciones 268 + 269 en Supabase (dedup_hash + tablas CCO).'
      : undefined;
    return NextResponse.json({ ok: false, error: message, hint }, { status: 500 });
  }
}
