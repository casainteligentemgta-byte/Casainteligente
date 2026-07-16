import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { generarDocumentoLegalPdfBlob } from '@/lib/legal/generarDocumentoLegalPdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/legal/documentos/generate-pdf
 * Body: { documentId } — genera PDF final del documento legal.
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

  const documentId = String(body.documentId ?? body.document_id ?? body.id ?? '').trim();
  if (!documentId) {
    return NextResponse.json({ error: 'documentId requerido' }, { status: 400 });
  }

  const { data, error } = await gate.admin
    .from('ci_legal_documentos')
    .select('id, titulo, cuerpo_markdown, cuerpo_estructurado, org_id')
    .eq('id', documentId)
    .eq('org_id', gate.acceso.orgId!)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: 'Ejecute migraciones 271 y 272 en Supabase.',
      },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  try {
    const { blob, filename } = await generarDocumentoLegalPdfBlob({
      titulo: String(data.titulo ?? 'Documento'),
      cuerpo_estructurado: data.cuerpo_estructurado,
      cuerpo_markdown: data.cuerpo_markdown,
    });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[legal generate-pdf]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
