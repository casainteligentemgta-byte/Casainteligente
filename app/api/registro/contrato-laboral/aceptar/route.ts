import { NextResponse } from 'next/server';
import { expedienteRefContratoLaboralRegistro } from '@/lib/talento/contratoLaboralPlantillaPdfBuffer';
import { generarYSubirConstanciaAceptacionLaboral } from '@/lib/talento/contratoLaboralRegistroStorage';
import { contratoObreroPorToken } from '@/lib/talento/contratoObreroToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function clientIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) {
    const first = xf.split(',')[0]?.trim();
    return first || null;
  }
  return req.headers.get('x-real-ip');
}

/**
 * POST { contrato_id, token } — Registra aceptación electrónica del contrato por el obrero,
 * genera constancia en PDF y deja traza en JSON (IP / user-agent) cuando la migración 116 está aplicada.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { contrato_id?: string; token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const contratoId = (body.contrato_id ?? '').trim();
  const token = (body.token ?? '').trim();
  if (!contratoId || !token) {
    return NextResponse.json({ error: 'contrato_id y token requeridos' }, { status: 400 });
  }

  const v = await contratoObreroPorToken(admin.client, contratoId, token);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  if (v.obreroAceptacionContratoAt) {
    return NextResponse.json({
      ok: true,
      ya_aceptado: true,
      obrero_aceptacion_contrato_at: v.obreroAceptacionContratoAt,
    });
  }

  const ahora = new Date().toISOString();
  const cliente = {
    ip: clientIp(req),
    user_agent: req.headers.get('user-agent'),
  };

  const patch: Record<string, unknown> = {
    obrero_aceptacion_contrato_at: ahora,
    obrero_aceptacion_cliente: cliente,
  };
  if ((v.estadoContrato ?? '').trim() === 'generado') {
    patch.estado_contrato = 'firmado_electronico';
  }

  const { error: up } = await admin.client
    .from('ci_contratos_empleado_obra')
    .update(patch as never)
    .eq('id', v.contratoId);

  if (up) {
    console.error('[contrato-laboral aceptar]', up);
    return NextResponse.json(
      {
        error: up.message,
        hint:
          'Si el error menciona una columna desconocida, ejecuta las migraciones 083 y 116 de ci_contratos_empleado_obra.',
      },
      { status: 500 },
    );
  }

  const { data: emp } = await admin.client
    .from('ci_empleados')
    .select('nombre_completo, documento, cedula')
    .eq('id', v.empleadoId)
    .maybeSingle();
  const e = emp as { nombre_completo?: string | null; documento?: string | null; cedula?: string | null } | null;
  const nombre = (e?.nombre_completo ?? '').trim() || 'Trabajador';
  const documento = (e?.cedula ?? e?.documento ?? '').trim() || '—';
  const expedienteRef = await expedienteRefContratoLaboralRegistro(admin.client, v.contratoId);

  const constancia = await generarYSubirConstanciaAceptacionLaboral(admin.client, {
    nombreTrabajador: nombre,
    documento,
    contratoId: v.contratoId,
    expedienteRef,
    aceptadoEnIso: ahora,
    ipCliente: cliente.ip,
  });
  if ('error' in constancia) {
    console.warn('[contrato-laboral aceptar] constancia no generada:', constancia.error);
  }

  return NextResponse.json({
    ok: true,
    obrero_aceptacion_contrato_at: ahora,
    estado_contrato: patch.estado_contrato ?? v.estadoContrato,
    constancia_ok: !('error' in constancia),
  });
}
