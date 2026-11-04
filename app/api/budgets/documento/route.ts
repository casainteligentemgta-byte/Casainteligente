import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { documentoClienteDesdeId } from '@/lib/presupuesto/cargarDocumento';
import { respuestaPdfPresupuesto } from '@/lib/presupuesto/respuestaPdf';
import { leerDocumentoPresupuesto } from '@/lib/presupuesto/tokenDocumento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/budgets/documento?t=TOKEN
 * Documento público del cliente (PDF o JSON), sin sesión y sin costos.
 * El token lo firma el servidor; adivinar el UUID no basta.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')?.trim() ?? '';
  const id = leerDocumentoPresupuesto(token);
  if (!id) {
    return NextResponse.json({ error: 'Enlace inválido o vencido.' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const loaded = await documentoClienteDesdeId(admin.client, id);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const format = (request.nextUrl.searchParams.get('format') ?? 'pdf').toLowerCase();
  if (format === 'json') {
    return NextResponse.json(
      { ok: true, documento: loaded.doc },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    return await respuestaPdfPresupuesto(loaded.doc, request, 'attachment');
  } catch (e) {
    console.error('[budgets documento]', e);
    return NextResponse.json({ error: 'No se pudo generar el PDF.' }, { status: 500 });
  }
}
