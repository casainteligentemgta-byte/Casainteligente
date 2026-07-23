import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  documentoPrintHtml,
  markdownLegalToHtml,
} from '@/lib/legal/renderDocumentoMarkdown';
import {
  documentoEstructuradoPrintHtml,
  estructuradoToMarkdown,
  parseDocumentoEstructurado,
} from '@/lib/legal/documentoEstructurado';
import { documentoPreviewHtml } from '@/lib/legal/documentoLegalShare';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT_271 =
  'Ejecute las migraciones 271 y 272 (documentos + cuerpo_estructurado) en Supabase.';

async function paramsId(
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<string> {
  const p = await Promise.resolve(ctx.params);
  return String(p.id ?? '').trim();
}

function cuerpoHtmlDocumento(data: {
  titulo?: unknown;
  cuerpo_markdown?: unknown;
  cuerpo_estructurado?: unknown;
}): string {
  const estructurado = parseDocumentoEstructurado(data.cuerpo_estructurado);
  if (estructurado) {
    // documentoEstructuradoPrintHtml ya envuelve documento completo; para preview
    // reutilizamos el mismo HTML de impresión sin auto-print vía format=preview abajo.
    return documentoEstructuradoPrintHtml(estructurado);
  }
  return documentoPrintHtml(
    String(data.titulo ?? 'Documento'),
    String(data.cuerpo_markdown ?? ''),
  );
}

/** GET — detalle; ?format=print|preview → HTML; ?format=share → metadatos de envío */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const id = await paramsId(ctx);
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { data, error } = await gate.admin
    .from('ci_legal_documentos')
    .select('*')
    .eq('id', id)
    .eq('org_id', gate.acceso.orgId!)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT_271 }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get('format');

  if (format === 'share') {
    const previewPath = `/api/legal/documentos/${id}?format=preview`;
    const printPath = `/api/legal/documentos/${id}?format=print`;
    return NextResponse.json({
      ok: true,
      titulo: String(data.titulo ?? 'Documento'),
      tipo: data.tipo ?? null,
      estado: data.estado ?? null,
      contraparte: data.contraparte ?? null,
      resumen: data.contraparte
        ? `Contraparte: ${String(data.contraparte)}`
        : undefined,
      preview_path: previewPath,
      print_path: printPath,
      preview_url: `${url.origin}${previewPath}`,
      print_url: `${url.origin}${printPath}`,
    });
  }

  if (format === 'preview') {
    const estructurado = parseDocumentoEstructurado(data.cuerpo_estructurado);
    if (estructurado) {
      // Quitar auto-print del HTML de impresión estructurado si lo hubiera:
      // generamos preview limpio desde markdown derivado.
      const md = estructuradoToMarkdown(estructurado);
      const html = documentoPreviewHtml(
        estructurado.document_title || String(data.titulo ?? 'Documento'),
        markdownLegalToHtml(md),
      );
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    const html = documentoPreviewHtml(
      String(data.titulo ?? 'Documento'),
      markdownLegalToHtml(String(data.cuerpo_markdown ?? '')),
    );
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (format === 'print' || format === 'html') {
    const html = cuerpoHtmlDocumento(data);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({ ok: true, documento: data });
}

/** PATCH — actualizar cuerpo / estado / metadatos / JSON estructurado */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const id = await paramsId(ctx);
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    actualizado_por: gate.userId,
    updated_at: new Date().toISOString(),
  };

  if (body.titulo != null) patch.titulo = String(body.titulo).trim();
  if (body.tipo != null) patch.tipo = String(body.tipo).trim();
  if (body.estado != null) patch.estado = String(body.estado).trim();
  if (body.contraparte !== undefined) {
    patch.contraparte =
      body.contraparte != null ? String(body.contraparte).trim() || null : null;
  }
  if (body.cuerpo_markdown != null) {
    patch.cuerpo_markdown = String(body.cuerpo_markdown);
  }
  if (body.caso_id !== undefined) {
    patch.caso_id = body.caso_id ? String(body.caso_id) : null;
  }
  if (body.variables_valores && typeof body.variables_valores === 'object') {
    patch.variables_valores = body.variables_valores;
  }

  const estructuradoRaw =
    body.cuerpo_estructurado ??
    body.estructurado ??
    (Array.isArray(body.blocks)
      ? {
          document_title:
            String(body.document_title ?? body.titulo ?? '').trim() || 'Documento',
          blocks: body.blocks,
        }
      : null);

  if (estructuradoRaw != null) {
    const estructurado = parseDocumentoEstructurado(estructuradoRaw);
    if (!estructurado) {
      return NextResponse.json(
        { error: 'cuerpo_estructurado inválido (document_title + blocks)' },
        { status: 400 },
      );
    }
    patch.cuerpo_estructurado = estructurado;
    if (body.sync_markdown !== false && body.cuerpo_markdown == null) {
      patch.cuerpo_markdown = estructuradoToMarkdown(estructurado);
    }
    if (body.titulo == null) {
      patch.titulo = estructurado.document_title;
    }
  }

  const { data, error } = await gate.admin
    .from('ci_legal_documentos')
    .update(patch)
    .eq('id', id)
    .eq('org_id', gate.acceso.orgId!)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT_271 }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, documento: data });
}
