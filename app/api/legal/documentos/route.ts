import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { aplicarVariablesPlantilla } from '@/lib/legal/documentosCatalogo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT_271 =
  'Ejecute la migración 271_ci_legal_documentos.sql en Supabase SQL Editor.';

/** GET — listado de documentos del org + plantillas disponibles. */
export async function GET(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const estado = url.searchParams.get('estado')?.trim() || null;
  const tipo = url.searchParams.get('tipo')?.trim() || null;
  const includePlantillas = url.searchParams.get('plantillas') !== '0';

  let q = gate.admin
    .from('ci_legal_documentos')
    .select('*')
    .eq('org_id', gate.acceso.orgId!)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (estado) q = q.eq('estado', estado);
  if (tipo) q = q.eq('tipo', tipo);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT_271 }, { status: 500 });
  }

  let plantillas: unknown[] = [];
  if (includePlantillas) {
    const { data: pls, error: pErr } = await gate.admin
      .from('ci_legal_plantillas')
      .select(
        'id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, variables, activo, cuerpo_markdown',
      )
      .eq('activo', true)
      .or(`org_id.is.null,org_id.eq.${gate.acceso.orgId}`)
      .order('titulo', { ascending: true });
    if (!pErr) plantillas = pls ?? [];
  }

  return NextResponse.json({
    ok: true,
    documentos: data ?? [],
    plantillas,
  });
}

/** POST — crear documento (desde plantilla o en blanco). */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const titulo = String(body.titulo ?? '').trim();
  if (!titulo) {
    return NextResponse.json({ error: 'titulo requerido' }, { status: 400 });
  }

  const plantillaId = body.plantilla_id ? String(body.plantilla_id) : null;
  const variablesValores =
    body.variables_valores && typeof body.variables_valores === 'object'
      ? (body.variables_valores as Record<string, string>)
      : {};

  let tipo = String(body.tipo ?? 'contrato').trim() || 'contrato';
  let cuerpo = String(body.cuerpo_markdown ?? '').trim();
  let plantillaRef: string | null = plantillaId;

  if (plantillaId) {
    const { data: pl, error: pErr } = await gate.admin
      .from('ci_legal_plantillas')
      .select('*')
      .eq('id', plantillaId)
      .maybeSingle();
    if (pErr || !pl) {
      return NextResponse.json(
        { error: pErr?.message || 'Plantilla no encontrada', hint: HINT_271 },
        { status: 404 },
      );
    }
    tipo = String(pl.tipo ?? tipo);
    if (!cuerpo) {
      cuerpo = aplicarVariablesPlantilla(String(pl.cuerpo_markdown ?? ''), variablesValores);
    }
  }

  const row = {
    org_id: gate.acceso.orgId!,
    caso_id: body.caso_id ? String(body.caso_id) : null,
    plantilla_id: plantillaRef,
    titulo,
    tipo,
    estado: String(body.estado ?? 'borrador').trim() || 'borrador',
    contraparte: body.contraparte != null ? String(body.contraparte).trim() || null : null,
    cuerpo_markdown: cuerpo,
    variables_valores: variablesValores,
    creado_por: gate.userId,
    actualizado_por: gate.userId,
  };

  const { data, error } = await gate.admin
    .from('ci_legal_documentos')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT_271 }, { status: 500 });
  }

  return NextResponse.json({ ok: true, documento: data });
}
