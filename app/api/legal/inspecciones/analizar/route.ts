import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { analyzeInspectionPhoto } from '@/lib/legal/iurisVigia';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/legal/inspecciones/analizar
 * Body: { image_url, context }  — o { image_base64, mime_type, context }
 */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const context = String(body.context ?? body.contexto ?? '').trim();
  if (!context) {
    return NextResponse.json({ error: 'context requerido' }, { status: 400 });
  }

  let imageUrl = String(body.image_url ?? body.imageUrl ?? '').trim();
  const b64 = String(body.image_base64 ?? body.imageBase64 ?? '').trim();
  const mime = String(body.mime_type ?? body.mimeType ?? 'image/jpeg').trim() || 'image/jpeg';

  if (!imageUrl && b64) {
    const raw = b64.replace(/^data:[^;]+;base64,/, '');
    imageUrl = `data:${mime};base64,${raw}`;
  }

  if (!imageUrl) {
    return NextResponse.json(
      { error: 'image_url o image_base64 requerido' },
      { status: 400 },
    );
  }

  try {
    const report = await analyzeInspectionPhoto(imageUrl, context);
    return NextResponse.json({
      ok: true,
      auditor: 'IurisVigía',
      context,
      report,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = msg.includes('OPENAI_API_KEY')
      ? 'Configure OPENAI_API_KEY en Vercel (visión gpt-4o).'
      : undefined;
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }
}
