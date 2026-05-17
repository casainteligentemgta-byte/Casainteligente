import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generarContratoRrhh } from '@/lib/contratos/rrhhContratoFlow';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function resolvePublicAppUrl(req: Request, bodyBase?: string): string {
  const origin = (req.headers.get('origin') ?? '').trim();
  if (origin && /^https?:\/\//i.test(origin)) return origin.replace(/\/$/, '');
  const fromBody = (bodyBase ?? '').trim();
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody.replace(/\/$/, '');
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ''
  ).replace(/\/$/, '');
}

/**
 * POST — Genera PDF borrador, guarda en Storage `contratos/proyectos/.../contrato_borrador.pdf`,
 * crea token de aceptación y devuelve mensaje WhatsApp.
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
    empleado_id?: string;
    empleadoId?: string;
    proyecto_id?: string;
    proyectoId?: string;
    public_base_url?: string;
    marcar_whatsapp_enviado?: boolean;
    overrides?: Record<string, string>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const empleadoId = (body.empleado_id ?? body.empleadoId ?? '').trim();
  const proyectoId = (body.proyecto_id ?? body.proyectoId ?? '').trim();
  const publicBaseUrl = resolvePublicAppUrl(req, body.public_base_url);
  if (!publicBaseUrl) {
    return NextResponse.json(
      { error: 'No se pudo determinar la URL pública. Define NEXT_PUBLIC_BASE_URL o envía public_base_url.' },
      { status: 503 },
    );
  }

  const out = await generarContratoRrhh(admin.client, {
    empleadoId,
    proyectoId,
    publicBaseUrl,
    marcarWhatsappEnviado: Boolean(body.marcar_whatsapp_enviado),
  });

  if ('error' in out) {
    return NextResponse.json({ error: out.error }, { status: out.status ?? 500 });
  }

  return NextResponse.json({
    ok: true,
    ...out,
    whatsapp_url: `https://wa.me/?text=${encodeURIComponent(out.mensajeWhatsapp)}`,
  });
}
