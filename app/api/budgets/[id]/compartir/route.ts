import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { documentoClienteDesdeId } from '@/lib/presupuesto/cargarDocumento';
import {
  firmarDocumentoPresupuesto,
  origenPublicoPresupuesto,
  urlDocumentoPresupuesto,
} from '@/lib/presupuesto/tokenDocumento';
import { mensajeWhatsAppPresupuesto, urlChatWhatsApp } from '@/lib/presupuesto/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/budgets/[id]/compartir
 * Mensaje de WhatsApp con resumen y enlace firmado al documento (sin costos).
 * Si no hay teléfono, avisa; no abre wa.me/58.
 */
export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const { id } = context.params;
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  }

  const loaded = await documentoClienteDesdeId(supabase, id);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const token = firmarDocumentoPresupuesto(id);
  const urlDocumento = urlDocumentoPresupuesto(origenPublicoPresupuesto(request), token);
  const mensaje = mensajeWhatsAppPresupuesto({
    numero: loaded.doc.numero,
    cliente: loaded.doc.cliente,
    subtotal: loaded.doc.subtotal,
    ivaPct: loaded.doc.ivaPct,
    urlDocumento,
  });
  const wa = urlChatWhatsApp(loaded.doc.telefono, mensaje);

  if (!wa.ok) {
    return NextResponse.json({
      ok: false,
      sinTelefono: true,
      motivo: wa.motivo,
      mensaje,
      urlDocumento,
    });
  }

  return NextResponse.json({
    ok: true,
    url: wa.url,
    numero: wa.numero,
    mensaje,
    urlDocumento,
  });
}
