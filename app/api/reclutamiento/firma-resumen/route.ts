import { NextResponse } from 'next/server';
import { resumenContratoParaFirma } from '@/lib/reclutamiento/datosPublicos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET ?token= — Resumen del contrato que el trabajador va a firmar (sin sesión).
 * El token de invitación es la credencial: solo devuelve el contrato de ese expediente.
 */
export async function GET(req: Request) {
  const token = (new URL(req.url).searchParams.get('token') ?? '').trim();

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const r = await resumenContratoParaFirma(admin.client, token);
  if (!r.ok) return NextResponse.json({ error: r.error, codigo: r.codigo }, { status: r.status });
  return NextResponse.json(r, { headers: { 'Cache-Control': 'private, no-store' } });
}
