import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aceptarContratoPorAdminBypass } from '@/lib/contratos/rrhhContratoFlow';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function clientIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || null;
  return req.headers.get('x-real-ip');
}

/**
 * POST — Aceptación digital por RRHH/Admin (bypass auditado).
 *
 * Body:
 * {
 *   "contrato_id": "uuid",
 *   "bypass_by_admin": true,
 *   "admin_id": "uuid_del_admin",
 *   "motivo": "Aceptación verbal en oficina / Pruebas de sistema"
 * }
 *
 * Alternativa: `empleado_id` en lugar de `contrato_id` (último contrato del empleado).
 */
export async function POST(req: Request) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Debe iniciar sesión (RRHH / Admin)' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: {
    contrato_id?: string;
    contratoId?: string;
    empleado_id?: string;
    empleadoId?: string;
    bypass_by_admin?: boolean;
    admin_id?: string;
    motivo?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (body.bypass_by_admin === false) {
    return NextResponse.json(
      { error: 'Este endpoint solo admite bypass_by_admin: true' },
      { status: 400 },
    );
  }

  const adminId = (body.admin_id ?? user.id).trim();
  const motivo = (body.motivo ?? 'Aceptación verbal en oficina / Pruebas de sistema').trim();

  const out = await aceptarContratoPorAdminBypass(admin.client, {
    contratoId: (body.contrato_id ?? body.contratoId ?? '').trim() || undefined,
    empleadoId: (body.empleado_id ?? body.empleadoId ?? '').trim() || undefined,
    adminId,
    motivo,
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  if ('error' in out) {
    return NextResponse.json({ error: out.error, ya_aceptado: false }, { status: out.status });
  }

  return NextResponse.json({
    ok: true,
    contrato_id: out.contratoId,
    estado_contrato: 'aceptado_digital',
    aceptado_digital_at: out.aceptadoEn,
    ya_aceptado: out.yaAceptado,
    metadatos_aceptacion: {
      bypass_by_admin: true,
      admin_id: adminId,
      motivo,
    },
  });
}
