import { NextResponse } from 'next/server';
import { validarExpedienteToken } from '@/lib/reclutamiento/validarExpedienteToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * POST { token } — Valida enlace de expediente / onboarding.
 * Respuesta: { valid: true, empleado: { nombre, cargo } } o error 404 / 410.
 */
export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ valid: false, error: 'JSON inválido' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const out = await validarExpedienteToken(admin.client, token);
  if (!out.valid) {
    return NextResponse.json({ valid: false, error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    valid: true,
    empleado: out.empleado,
    empleadoId: out.empleadoId,
    source: out.source,
  });
}
