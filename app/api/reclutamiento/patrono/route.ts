import { NextResponse } from 'next/server';
import { patronoPlanillaPorToken } from '@/lib/reclutamiento/datosPublicos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET ?token= — Datos del patrono (empresa, representante, obra) para la planilla que
 * llena el candidato con su enlace. El token de invitación es la credencial.
 */
export async function GET(req: Request) {
  const token = (new URL(req.url).searchParams.get('token') ?? '').trim();

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const r = await patronoPlanillaPorToken(admin.client, token);
  if (!r.ok) return NextResponse.json({ error: r.error, codigo: r.codigo }, { status: r.status });
  return NextResponse.json(r, { headers: { 'Cache-Control': 'private, no-store' } });
}
