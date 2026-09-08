import { NextRequest, NextResponse } from 'next/server';
import {
  indexarManualPDF,
  listarManuales,
  responderPreguntaMecanica,
  responderPreguntaMecanico,
} from '@/lib/flota/chatbot';
import { requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  try {
    const manuals = await listarManuales(auth.supabase);
    if (manuals.migracionPendiente) return respuestaMigracionPendiente({ manuales: [] });
    return NextResponse.json({ ok: true, manuales: manuals.items });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.accion === 'indexar' || body.contenido_texto != null) {
      const result = await indexarManualPDF(String(body.contenido_texto ?? body.texto ?? ''));
      return NextResponse.json({ ok: true, ...result });
    }

    const pregunta = String(body.pregunta ?? '').trim();
    const manual_contexto =
      body.manual_contexto != null
        ? String(body.manual_contexto)
        : body.contexto_manual != null
          ? String(body.contexto_manual)
          : undefined;

    if (!pregunta) {
      return NextResponse.json({ error: 'pregunta requerida' }, { status: 400 });
    }

    if (manual_contexto != null) {
      const respuesta = await responderPreguntaMecanica(pregunta, manual_contexto || undefined);
      return NextResponse.json({ pregunta, respuesta });
    }

    const result = await responderPreguntaMecanico(auth.supabase, pregunta);
    return NextResponse.json({ pregunta, respuesta: result.respuesta, fuentes: result.fuentes });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
