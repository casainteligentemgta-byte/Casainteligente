import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function trimBase(u: string) {
  return u.trim().replace(/\/$/, '');
}

function publicBase(req: Request, bodyUrl?: string) {
  const origin = trimBase(req.headers.get('origin') ?? '');
  if (origin && /^https?:\/\//i.test(origin)) return origin;
  const b = trimBase(bodyUrl ?? '');
  if (b && /^https?:\/\//i.test(b)) return b;
  return trimBase(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
}

/**
 * POST { recruitment_need_id, public_base_url? }
 * Genera o reutiliza `recruitment_needs.captacion_token` y devuelve la URL `/registro/[token]`.
 * Opcional: RECRUITMENT_CAPTACION_SECRET → Authorization: Bearer …
 */
export async function POST(req: Request) {
  const secret = process.env.RECRUITMENT_CAPTACION_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization');
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (bearer !== secret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { recruitment_need_id?: string; public_base_url?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const needId = (body.recruitment_need_id ?? '').trim();
  if (!needId) {
    return NextResponse.json({ error: 'recruitment_need_id requerido' }, { status: 400 });
  }

  const { data: row, error: selErr } = await admin.client
    .from('recruitment_needs')
    .select('id,captacion_token')
    .eq('id', needId)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json(
      {
        error: selErr.message,
        hint: (selErr.message ?? '').includes('captacion_token')
          ? 'Ejecuta la migración 073_recruitment_captacion_token.sql en Supabase.'
          : undefined,
      },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json({ error: 'Vacante no encontrada' }, { status: 404 });
  }

  const r = row as { id: string; captacion_token?: string | null };
  let token = (r.captacion_token ?? '').trim();
  if (!token) {
    token = randomBytes(32).toString('hex');
    const { error: upErr } = await admin.client
      .from('recruitment_needs')
      .update({ captacion_token: token } as never)
      .eq('id', needId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  const base = publicBase(req, body.public_base_url);
  if (!base) {
    return NextResponse.json(
      {
        error: 'config',
        hint: 'Define NEXT_PUBLIC_BASE_URL o envía public_base_url en el cuerpo (origen https del CRM).',
      },
      { status: 503 },
    );
  }

  const url = `${base}/registro/${encodeURIComponent(token)}`;
  return NextResponse.json({ ok: true, token, url });
}
