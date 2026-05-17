import { NextResponse } from 'next/server';
import { aceptarContratoPorToken } from '@/lib/contratos/rrhhContratoFlow';
import { generarYSubirConstanciaAceptacionLaboral } from '@/lib/talento/contratoLaboralRegistroStorage';
import { expedienteRefContratoLaboralRegistro } from '@/lib/talento/contratoLaboralPlantillaPdfBuffer';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function clientIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || null;
  return req.headers.get('x-real-ip');
}

/**
 * POST público — Aceptación digital del obrero (token en body).
 * Solo modifica la fila validada vía service_role + token_aceptacion / token_registro.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: {
    contrato_id?: string;
    contratoId?: string;
    token?: string;
    geolocalizacion?: { lat?: number; lng?: number; precision?: number };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const contratoId = (body.contrato_id ?? body.contratoId ?? '').trim();
  const token = (body.token ?? '').trim();
  const lat = body.geolocalizacion?.lat;
  const lng = body.geolocalizacion?.lng;

  const geo =
    typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, precision: body.geolocalizacion?.precision }
      : null;

  const out = await aceptarContratoPorToken(admin.client, {
    contratoId,
    token,
    metadatos: {
      ip: clientIp(req),
      user_agent: req.headers.get('user-agent'),
      geolocalizacion: geo,
    },
  });

  if ('error' in out) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  const { data: ctr } = await admin.client
    .from('ci_contratos_empleado_obra')
    .select('empleado_id')
    .eq('id', contratoId)
    .maybeSingle();
  const empleadoId = (ctr as { empleado_id?: string } | null)?.empleado_id;
  if (empleadoId) {
    const { data: emp } = await admin.client
      .from('ci_empleados')
      .select('nombre_completo,documento,cedula')
      .eq('id', empleadoId)
      .maybeSingle();
    const e = emp as { nombre_completo?: string | null; documento?: string | null; cedula?: string | null } | null;
    const expedienteRef = await expedienteRefContratoLaboralRegistro(admin.client, contratoId);
    await generarYSubirConstanciaAceptacionLaboral(admin.client, {
      nombreTrabajador: (e?.nombre_completo ?? '').trim() || 'Trabajador',
      documento: (e?.cedula ?? e?.documento ?? '').trim() || '—',
      contratoId,
      expedienteRef,
      aceptadoEnIso: out.aceptadoEn,
      ipCliente: clientIp(req),
    });
  }

  return NextResponse.json({
    ok: true,
    valid: true,
    estado_contrato: 'aceptado_digital',
    aceptado_digital_at: out.aceptadoEn,
  });
}
