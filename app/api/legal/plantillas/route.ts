import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  esTipoDocumentoLegal,
  extraerVariablesDeCuerpo,
  slugCodigoPlantilla,
} from '@/lib/legal/plantillasFormatos';
import type { LegalPlantillaVariable } from '@/lib/legal/documentosCatalogo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT =
  'Ejecute las migraciones 271 y 273 (plantillas + archivos) en Supabase SQL Editor.';

/** GET — listado de formatos/plantillas del org (+ globales). */
export async function GET(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const soloOrg = url.searchParams.get('solo_org') === '1';
  const incluirInactivas = url.searchParams.get('inactivas') === '1';

  let q = gate.admin
    .from('ci_legal_plantillas')
    .select(
      'id, org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, variables, activo, archivo_nombre, archivo_mime, archivo_storage_path, created_at, updated_at, cuerpo_markdown',
    )
    .order('titulo', { ascending: true })
    .limit(300);

  if (!incluirInactivas) q = q.eq('activo', true);
  if (soloOrg) q = q.eq('org_id', gate.acceso.orgId!);
  else q = q.or(`org_id.is.null,org_id.eq.${gate.acceso.orgId}`);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plantillas: data ?? [] });
}

/** POST — crear formato/plantilla (JSON). Para archivo use /upload. */
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

  const tipoRaw = String(body.tipo ?? 'contrato').trim() || 'contrato';
  const tipo = esTipoDocumentoLegal(tipoRaw) ? tipoRaw : 'otro';
  const cuerpo = String(body.cuerpo_markdown ?? '').trim();
  if (!cuerpo) {
    return NextResponse.json(
      { error: 'cuerpo_markdown requerido (o suba un archivo en /upload)' },
      { status: 400 },
    );
  }

  const codigoBase =
    String(body.codigo ?? '').trim() || slugCodigoPlantilla(titulo);
  const codigo = codigoBase.slice(0, 80);

  let variables: LegalPlantillaVariable[] = Array.isArray(body.variables)
    ? (body.variables as LegalPlantillaVariable[])
    : extraerVariablesDeCuerpo(cuerpo);

  const row = {
    org_id: gate.acceso.orgId!,
    codigo,
    titulo,
    tipo,
    jurisdiccion: String(body.jurisdiccion ?? 'venezuela').trim() || 'venezuela',
    categoria: String(body.categoria ?? 'general').trim() || 'general',
    descripcion: String(body.descripcion ?? '').trim() || null,
    cuerpo_markdown: cuerpo,
    variables,
    activo: body.activo === false ? false : true,
    archivo_storage_path: body.archivo_storage_path
      ? String(body.archivo_storage_path)
      : null,
    archivo_nombre: body.archivo_nombre ? String(body.archivo_nombre) : null,
    archivo_mime: body.archivo_mime ? String(body.archivo_mime) : null,
  };

  const { data, error } = await gate.admin
    .from('ci_legal_plantillas')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    if (/unique|duplicate|ci_legal_plantillas_org_codigo/i.test(error.message)) {
      return NextResponse.json(
        {
          error: `Ya existe un formato con código «${codigo}». Cambie el código o el título.`,
          hint: HINT,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plantilla: data }, { status: 201 });
}
