import { NextResponse } from 'next/server';
import { procesarAbastecimientoProcuraAprobada } from '@/lib/procuras/abastecimientoProcuraAprobada';
import { emitirOrdenCompraProcura } from '@/lib/procuras/emitirOrdenCompraProcura';
import { informarViabilidadAdminProcura } from '@/lib/procuras/informarViabilidadAdminProcura';
import { notificarProcurasTelegram } from '@/lib/procuras/notificarProcuraTelegram';
import { parseEstadoProcura } from '@/lib/procuras/procuraEstados';
import {
  MIN_MOTIVO_RECHAZO_PROCURA,
  rechazarProcuraConMotivo,
  type RechazarProcuraResult,
} from '@/lib/procuras/rechazarProcura';
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
      viabilidadPresupuestaria?: 'si' | 'no';
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
    let actorNombre = 'Usuario web';

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
      actorNombre = authAlt.actor.nombre?.trim() || actorNombre;
    } else {
      if (!puedeProcesarEstadoProcuraWeb(auth.actor, nuevoEstado)) {
        return NextResponse.json({ error: 'No tiene permiso para este cambio de estado.' }, { status: 403 });
      }
      actorNombre = auth.actor.nombre?.trim() || actorNombre;
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    if (nuevoEstado === 'pendiente_pm') {
      const viabilidad = body.viabilidadPresupuestaria;
      if (viabilidad !== 'si' && viabilidad !== 'no') {
        return NextResponse.json(
          { error: 'Indique viabilidadPresupuestaria: «si» o «no».' },
          { status: 400 },
        );
      }

      const resultados: Array<{ ticket?: string; pmsNotificados?: number; error?: string }> = [];
      for (const id of ids) {
        const r = await informarViabilidadAdminProcura(admin.client, {
          procuraId: id,
          viabilidad,
          adminNombre: actorNombre,
        });
        resultados.push(
          r.ok
            ? { ticket: r.ticket, pmsNotificados: r.pmsNotificados }
            : { error: r.error },
        );
      }

      const okCount = resultados.filter((r) => !r.error).length;
      const pms = resultados.reduce((acc, r) => acc + (r.pmsNotificados ?? 0), 0);
      const errores = resultados.map((r) => r.error).filter(Boolean);
      if (!okCount) {
        return NextResponse.json(
          { error: errores[0] ?? 'No se pudo informar viabilidad.' },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        count: okCount,
        estado: 'pendiente_pm',
        pms_notificados: pms,
        errores: errores.length ? errores : undefined,
      });
    }

    if (nuevoEstado === 'aprobada') {
      for (const id of ids) {
        const { data: row } = await admin.client
          .from('ci_procuras')
          .select('estado,ticket')
          .eq('id', id)
          .maybeSingle();
        const procRow = row as { estado?: string; ticket?: string } | null;
        const est = String(procRow?.estado ?? '').toLowerCase();
        if (est !== 'pendiente_pm') {
          return NextResponse.json(
            {
              error:
                est === 'solicitada'
                  ? `La procura ${procRow?.ticket ?? id} espera viabilidad del Administrador.`
                  : `La procura ${procRow?.ticket ?? id} no está pendiente de PM.`,
            },
            { status: 400 },
          );
        }
      }

      const ordenes: Array<{
        ticket?: string;
        estado?: string;
        compradoresNotificados?: number;
        error?: string;
      }> = [];
      for (const id of ids) {
        const r = await procesarAbastecimientoProcuraAprobada(admin.client, {
          procuraId: id,
          autorNombre: actorNombre,
        });
        ordenes.push({
          ticket: r.ticket,
          estado: r.estado,
          compradoresNotificados: r.compraEmitida ? 1 : 0,
          error: r.error,
        });
      }
      const okCount = ordenes.filter((o) => !o.error).length;
      const compradores = ordenes.reduce(
        (acc, o) => acc + (o.compradoresNotificados ?? 0),
        0,
      );
      const errores = ordenes.map((o) => o.error).filter(Boolean);
      if (!okCount) {
        return NextResponse.json(
          { error: errores[0] ?? 'No se pudo aprobar ninguna procura.' },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        count: okCount,
        estado: 'aprobada',
        compradores_notificados: compradores,
        ordenes,
        errores: errores.length ? errores : undefined,
      });
    }

    if (nuevoEstado === 'aprobada_directa') {
      const ordenes: Array<{
        ticket?: string;
        estado?: string;
        compradoresNotificados?: number;
        error?: string;
      }> = [];
      for (const id of ids) {
        const r = await emitirOrdenCompraProcura(admin.client, {
          procuraId: id,
          autorNombre: actorNombre,
          motivo: motivo ?? `Orden de compra emitida desde web por ${actorNombre}`,
        });
        ordenes.push(r.ok ? r : { error: r.error });
      }
      const okCount = ordenes.filter((o) => !o.error).length;
      const compradores = ordenes.reduce(
        (acc, o) => acc + (o.compradoresNotificados ?? 0),
        0,
      );
      const errores = ordenes.map((o) => o.error).filter(Boolean);
      if (!okCount) {
        return NextResponse.json(
          { error: errores[0] ?? 'No se pudo emitir ninguna orden de compra.' },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        count: okCount,
        estado: 'aprobada_directa',
        compradores_notificados: compradores,
        errores: errores.length ? errores : undefined,
      });
    }

    if (nuevoEstado === 'rechazada') {
      if (!motivo || motivo.length < MIN_MOTIVO_RECHAZO_PROCURA) {
        return NextResponse.json(
          {
            error: `Indique el motivo del rechazo (mínimo ${MIN_MOTIVO_RECHAZO_PROCURA} caracteres).`,
          },
          { status: 400 },
        );
      }

      const resultados: RechazarProcuraResult[] = [];
      for (const id of ids) {
        resultados.push(
          await rechazarProcuraConMotivo(admin.client, {
            procuraId: id,
            motivo,
            aprobadorNombre: actorNombre,
          }),
        );
      }

      const okCount = resultados.filter((r) => r.ok).length;
      const errores = resultados.map((r) => r.error).filter(Boolean);
      const notificados = resultados.filter((r) => r.solicitanteNotificado).length;

      if (!okCount) {
        return NextResponse.json(
          { error: errores[0] ?? 'No se pudo rechazar ninguna procura.' },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        count: okCount,
        estado: 'rechazada',
        solicitantes_notificados: notificados,
        errores: errores.length ? errores : undefined,
      });
    }

    if (nuevoEstado === 'en_compra') {
      return NextResponse.json(
        {
          error:
            '«Comprada» solo aplica al registrar la factura (/facturas). No se puede forzar manualmente.',
        },
        { status: 400 },
      );
    }

    const { data, error } = await admin.client.rpc(
      'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo',
      {
        p_ids: ids,
        p_nuevo_estado: nuevoEstado,
        p_motivo: motivo,
      } as never,
    );

    if (error) {
      const hint = /procesar_procuras_lote|could not choose|PGRST203|purchase_invoice_id/i.test(
        error.message,
      )
        ? 'Ejecute migraciones 224, 238 y 244 en Supabase.'
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
