import { NextResponse } from 'next/server';
import { notificarProcurasTelegram } from '@/lib/procuras/notificarProcuraTelegram';
import { parseEstadoProcura } from '@/lib/procuras/procuraEstados';
import { puedeProcesarEstadoProcuraWeb } from '@/lib/auth/permisos';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RpcRow = {
  procura_id: string;
  ticket: string;
  material_txt: string;
  nuevo_est: string;
  telegram_id: string | null;
};

/** POST — Cambia estado de procuras en lote y notifica por Telegram. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      ids?: string[];
      nuevoEstado?: string;
      motivo?: string | null;
      notificar_telegram?: boolean;
    };

    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
    const nuevoEstado = parseEstadoProcura(body.nuevoEstado);
    const motivo = body.motivo?.trim() || null;
    const notificar = body.notificar_telegram !== false;

    if (!ids.length) {
      return NextResponse.json({ error: 'Indique al menos un id de procura.' }, { status: 400 });
    }
    if (!nuevoEstado) {
      return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 });
    }

    const auth = await requirePermisoWeb('procura.aprobar');
    if (!auth.ok) {
      const permAlt =
        nuevoEstado === 'en_compra'
          ? ('procura.ejecutar_compra' as const)
          : nuevoEstado === 'aprobada'
            ? ('procura.usar_almacen' as const)
            : ('procura.aprobar' as const);
      const authAlt = await requirePermisoWeb(permAlt);
      if (!authAlt.ok || !puedeProcesarEstadoProcuraWeb(authAlt.actor, nuevoEstado)) {
        return authAlt.ok
          ? NextResponse.json({ error: 'No tiene permiso para este cambio de estado.' }, { status: 403 })
          : authAlt.response;
      }
    } else if (!puedeProcesarEstadoProcuraWeb(auth.actor, nuevoEstado)) {
      return NextResponse.json({ error: 'No tiene permiso para este cambio de estado.' }, { status: 403 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { data, error } = await admin.client.rpc(
      'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo',
      {
        p_ids: ids,
        p_nuevo_estado: nuevoEstado,
        p_motivo: motivo,
      } as never,
    );

    if (error) {
      const hint = /procesar_procuras_lote|could not choose|PGRST203/i.test(error.message)
        ? 'Ejecute migraciones 224 y 238_repair_procesar_procuras_lote_overload.sql en Supabase.'
        : undefined;
      return NextResponse.json({ error: error.message, hint }, { status: 500 });
    }

    const procuras = (data ?? []) as RpcRow[];
    let telegram = { enviados: 0, omitidos: 0 };
    if (notificar && procuras.length) {
      telegram = await notificarProcurasTelegram(procuras, motivo);
    }

    return NextResponse.json({
      ok: true,
      count: procuras.length,
      procuras,
      telegram,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al procesar lote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
