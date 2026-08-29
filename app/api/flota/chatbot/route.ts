import { NextResponse } from 'next/server';
import { listarManuales, responderPreguntaMecanico } from '@/lib/flota/chatbot';
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
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al listar manuales' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const pregunta = String(body.pregunta ?? '').trim();
  if (!pregunta) return NextResponse.json({ error: 'pregunta requerida' }, { status: 400 });

  try {
    const result = await responderPreguntaMecanico(auth.supabase, pregunta);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al consultar el mecánico';
    return NextResponse.json({ error: msg }, { status: /específica|requerid/i.test(msg) ? 400 : 500 });
  }
}
