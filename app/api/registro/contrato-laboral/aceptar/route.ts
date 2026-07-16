import { NextResponse } from 'next/server';
import { aceptarContratoPorToken } from '@/lib/contratos/rrhhContratoFlow';
import { expedienteRefContratoLaboralRegistro } from '@/lib/talento/contratoLaboralPlantillaPdfBuffer';
import { generarYSubirConstanciaAceptacionLaboral } from '@/lib/talento/contratoLaboralRegistroStorage';
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

  let body: {
    contrato_id?: string;
    token?: string;
    geolocalizacion?: { lat?: number; lng?: number; precision?: number };
  };
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
      .select('nombre_completo, documento, cedula')
      .eq('id', empleadoId)
      .maybeSingle();
    const e = emp as { nombre_completo?: string | null; documento?: string | null; cedula?: string | null } | null;
    const nombre = (e?.nombre_completo ?? '').trim() || 'Trabajador';
    const documento = (e?.cedula ?? e?.documento ?? '').trim() || '—';
    const expedienteRef = await expedienteRefContratoLaboralRegistro(admin.client, contratoId);
    const constancia = await generarYSubirConstanciaAceptacionLaboral(admin.client, {
      nombreTrabajador: nombre,
      documento,
      contratoId,
      expedienteRef,
      aceptadoEnIso: out.aceptadoEn,
      ipCliente: clientIp(req),
    });
    if ('error' in constancia) {
      console.warn('[contrato-laboral aceptar] constancia no generada:', constancia.error);
    }
  }

  return NextResponse.json({
    ok: true,
    obrero_aceptacion_contrato_at: out.aceptadoEn,
    aceptado_digital_at: out.aceptadoEn,
    estado_contrato: 'aceptado_digital',
    constancia_ok: true,
  });
}
