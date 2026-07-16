import { NextResponse } from 'next/server';
import {
  ceoSecretConfigured,
  getCeoCookieValue,
  recruitmentCeoCookieName,
} from '@/lib/recruitment/ceo-auth';

const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export async function POST(req: Request) {
  const secret = process.env.RECRUITMENT_CEO_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'RECRUITMENT_CEO_SECRET no configurada' }, { status: 503 });
  }
  const body = (await req.json()) as { secret?: string };
  if (body.secret !== secret) {
    return NextResponse.json({ error: 'credenciales inválidas' }, { status: 401 });
  }
  const token = getCeoCookieValue(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(recruitmentCeoCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(recruitmentCeoCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

export async function GET() {
  return NextResponse.json({
    ceoAuthRequired: ceoSecretConfigured(),
  });
}
