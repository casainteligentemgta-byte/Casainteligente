import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { documentoClienteDesdeId } from '@/lib/presupuesto/cargarDocumento';
import { respuestaPdfPresupuesto } from '@/lib/presupuesto/respuestaPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/budgets/[id]/pdf
 * PDF real (application/pdf) para descargar o compartir desde el móvil.
 * Requiere sesión. El cliente sin sesión usa /api/budgets/documento?t=…
 */
export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const { id } = context.params;
  if (!id) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Inicia sesión para descargar el PDF.' }, { status: 401 });
  }

  const loaded = await documentoClienteDesdeId(supabase, id);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  try {
    return await respuestaPdfPresupuesto(loaded.doc, request, 'attachment');
  } catch (e) {
    console.error('[budgets pdf]', e);
    return NextResponse.json({ error: 'No se pudo generar el PDF.' }, { status: 500 });
  }
}
