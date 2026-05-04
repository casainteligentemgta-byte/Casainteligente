import { NextResponse } from 'next/server';
import { ensureCiExamenInviteForEmpleado } from '@/lib/talento/ensureCiExamenInviteForEmpleado';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normDoc(s: string): string {
  return s.replace(/\uFEFF/g, '').trim().replace(/^v/i, '').replace(/\s+/g, '');
}

function trimBase(u: string): string {
  return u.trim().replace(/\/$/, '');
}

function resolvePublicBase(req: Request): string {
  const origin = trimBase(req.headers.get('origin') ?? '');
  if (origin && /^https?:\/\//i.test(origin)) return origin;
  const env = trimBase(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  if (env && /^https?:\/\//i.test(env)) return env;
  try {
    return trimBase(new URL(req.url).origin);
  } catch {
    return '';
  }
}

/**
 * POST { empleadoId, cedula } — Crea `ci_examenes` si falta (mismo token que `token_registro` del empleado).
 * Comprueba que la cédula coincida con el expediente (mitiga enumeración solo con UUID).
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { empleadoId?: string; cedula?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const empleadoId = (body.empleadoId ?? '').trim();
  const cedulaIn = (body.cedula ?? '').trim();
  if (!empleadoId || !UUID_RE.test(empleadoId)) {
    return NextResponse.json({ error: 'empleadoId inválido' }, { status: 400 });
  }
  if (!cedulaIn) {
    return NextResponse.json({ error: 'cedula requerida' }, { status: 400 });
  }

  const { data: row, error: qErr } = await admin.client
    .from('ci_empleados')
    .select('id, documento, cedula, token, token_registro')
    .eq('id', empleadoId)
    .maybeSingle();

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const r = row as {
    documento: string | null;
    cedula: string | null;
    token: string | null;
    token_registro: string | null;
  };
  const docDb = normDoc(String(r.cedula ?? r.documento ?? ''));
  const docIn = normDoc(cedulaIn);
  if (!docDb || docDb !== docIn) {
    return NextResponse.json({ error: 'La cédula no coincide con este expediente' }, { status: 403 });
  }

  const token = String(r.token_registro ?? r.token ?? '').trim();
  if (!token) {
    return NextResponse.json(
      {
        error: 'El expediente no tiene token de registro',
        hint: 'Ejecuta la migración 081_ci_empleados_token_default.sql o revisa ci_empleados.token_registro.',
      },
      { status: 409 },
    );
  }

  const ensured = await ensureCiExamenInviteForEmpleado(admin.client, { empleadoId, token });
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  const base = resolvePublicBase(req);
  if (!base) {
    return NextResponse.json(
      { error: 'No se pudo determinar la URL pública (Origin o NEXT_PUBLIC_BASE_URL).' },
      { status: 503 },
    );
  }

  const exam_url = `${base}/talento/examen?token=${encodeURIComponent(token)}`;
  const onboarding_url = `${base}/reclutamiento/onboarding/${encodeURIComponent(token)}`;

  return NextResponse.json({ exam_url, onboarding_url });
}
