import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  esTipoDocumentoLegal,
  extraerVariablesDeCuerpo,
  LEGAL_PLANTILLAS_BUCKET,
} from '@/lib/legal/plantillasFormatos';
import type { LegalPlantillaVariable } from '@/lib/legal/documentosCatalogo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT =
  'Ejecute las migraciones 271 y 273 (plantillas + archivos) en Supabase SQL Editor.';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(ctx: Ctx): Promise<string> {
  const params = await Promise.resolve(ctx.params);
  return String(params.id ?? '').trim();
}

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const id = await resolveId(ctx);
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { data, error } = await gate.admin
    .from('ci_legal_plantillas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }
  if (data.org_id && data.org_id !== gate.acceso.orgId) {
    return NextResponse.json({ error: 'Sin acceso a esta plantilla' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, plantilla: data });
}

/** PATCH — actualizar formato del org (no globales seed). */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const id = await resolveId(ctx);
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { data: actual, error: getErr } = await gate.admin
    .from('ci_legal_plantillas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (getErr) {
    return NextResponse.json({ error: getErr.message, hint: HINT }, { status: 500 });
  }
  if (!actual) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }
  if (!actual.org_id || actual.org_id !== gate.acceso.orgId) {
    return NextResponse.json(
      { error: 'Solo puede editar formatos de su organización (no los globales del sistema).' },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.titulo != null) patch.titulo = String(body.titulo).trim();
  if (body.descripcion != null) {
    patch.descripcion = String(body.descripcion).trim() || null;
  }
  if (body.categoria != null) {
    patch.categoria = String(body.categoria).trim() || 'general';
  }
  if (body.jurisdiccion != null) {
    patch.jurisdiccion = String(body.jurisdiccion).trim() || 'venezuela';
  }
  if (body.tipo != null) {
    const t = String(body.tipo).trim();
    patch.tipo = esTipoDocumentoLegal(t) ? t : 'otro';
  }
  if (body.activo != null) patch.activo = Boolean(body.activo);
  if (body.cuerpo_markdown != null) {
    const cuerpo = String(body.cuerpo_markdown);
    patch.cuerpo_markdown = cuerpo;
    if (!Array.isArray(body.variables)) {
      patch.variables = extraerVariablesDeCuerpo(cuerpo);
    }
  }
  if (Array.isArray(body.variables)) {
    patch.variables = body.variables as LegalPlantillaVariable[];
  }
  if (body.codigo != null) {
    patch.codigo = String(body.codigo).trim().slice(0, 80);
  }

  const { data, error } = await gate.admin
    .from('ci_legal_plantillas')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plantilla: data });
}

/** DELETE — desactiva (soft) o borra formato del org. ?hard=1 elimina fila + archivo. */
export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const id = await resolveId(ctx);
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const hard = new URL(req.url).searchParams.get('hard') === '1';

  const { data: actual, error: getErr } = await gate.admin
    .from('ci_legal_plantillas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (getErr) {
    return NextResponse.json({ error: getErr.message, hint: HINT }, { status: 500 });
  }
  if (!actual) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }
  if (!actual.org_id || actual.org_id !== gate.acceso.orgId) {
    return NextResponse.json(
      { error: 'Solo puede eliminar formatos de su organización.' },
      { status: 403 },
    );
  }

  if (hard) {
    const path = String(actual.archivo_storage_path ?? '').trim();
    if (path) {
      await gate.admin.storage.from(LEGAL_PLANTILLAS_BUCKET).remove([path]);
    }
    const { error } = await gate.admin.from('ci_legal_plantillas').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: true });
  }

  const { data, error } = await gate.admin
    .from('ci_legal_plantillas')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plantilla: data });
}
