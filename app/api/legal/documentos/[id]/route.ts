import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { documentoPrintHtml } from '@/lib/legal/renderDocumentoMarkdown';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT_271 =
  'Ejecute la migración 271_ci_legal_documentos.sql en Supabase SQL Editor.';

async function paramsId(
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<string> {
  const p = await Promise.resolve(ctx.params);
  return String(p.id ?? '').trim();
}

/** GET — detalle; ?format=print → HTML imprimible */
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

  const format = new URL(req.url).searchParams.get('format');
  if (format === 'print' || format === 'html') {
    const html = documentoPrintHtml(
      String(data.titulo ?? 'Documento'),
      String(data.cuerpo_markdown ?? ''),
    );
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({ ok: true, documento: data });
}

/** PATCH — actualizar cuerpo / estado / metadatos */
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
