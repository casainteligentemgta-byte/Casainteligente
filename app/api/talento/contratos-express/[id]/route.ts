import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermisoRrhhAny, requirePermisoRrhhObra } from '@/lib/rrhh/requirePermisoRrhh';
import { BUCKET_CONTRATOS_OBREROS } from '@/lib/talento/contratoLaboralRegistroStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { actualizarContratoExpress } from '@/lib/talento/actualizarContratoExpress';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ExpressRowPaths = {
  pdf_storage_path: string | null;
  pdf_firmado_storage_path?: string | null;
};

const patchSchema = z.object({
  obrero_nombre: z.string().max(220).optional().nullable(),
  obrero_nombres: z.string().max(120).optional().nullable(),
  obrero_apellidos: z.string().max(120).optional().nullable(),
  obrero_cedula: z.string().max(32).optional().nullable(),
  obrero_direccion: z.string().max(500).optional().nullable(),
  estado_civil: z.string().max(80).optional().nullable(),
  nacionalidad: z.string().max(80).optional().nullable(),
  fecha_ingreso: z.string().max(40).optional().nullable(),
  horario_semanal_texto: z.string().max(2000).optional().nullable(),
  bono_manual_usd: z.coerce.number().nonnegative().optional().nullable(),
  config_nomina_id: z.string().uuid().optional().nullable(),
  objeto_contrato: z.string().max(4000).optional().nullable(),
  jornada_trabajo: z.string().max(80).optional().nullable(),
  obrero_municipio_residencia: z.string().max(120).optional().nullable(),
  obrero_estado_residencia: z.string().max(120).optional().nullable(),
  regenerar_pdf: z.boolean().optional(),
});

/**
 * GET — Datos editables del contrato express (para el modal de edición).
 */
export async function GET(_req: Request, context: { params: { id: string } }) {
  const gate = await requirePermisoRrhhAny();
  if (!gate.ok) return gate.response;

  const id = (context.params?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const full = await admin.client
    .from('ci_contratos_express')
    .select(
      'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_nombres,obrero_apellidos,obrero_cedula,obrero_direccion,horario_semanal_texto,bono_manual_usd,cargo_nombre_snapshot,estado_civil,nacionalidad,fecha_ingreso,objeto_contrato,jornada_trabajo,obrero_municipio_residencia,obrero_estado_residencia,created_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (full.error && /column|42703|schema cache|Could not find/i.test(full.error.message)) {
    const bare = await admin.client
      .from('ci_contratos_express')
      .select(
        'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_cedula,obrero_direccion,horario_semanal_texto,bono_manual_usd,cargo_nombre_snapshot,fecha_ingreso,created_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (bare.error) return NextResponse.json({ error: bare.error.message }, { status: 500 });
    if (!bare.data) return NextResponse.json({ error: 'Contrato express no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, contrato: bare.data, schema_parcial: true });
  }

  if (full.error) return NextResponse.json({ error: full.error.message }, { status: 500 });
  if (!full.data) return NextResponse.json({ error: 'Contrato express no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, contrato: full.data });
}

/**
 * PATCH — Edita campos que recaudan información y regenera el PDF (por defecto).
 */
export async function PATCH(req: Request, context: { params: { id: string } }) {
  const gate = await requirePermisoRrhhObra();
  if (!gate.ok) return gate.response;

  const id = (context.params?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const out = await actualizarContratoExpress(admin.client, id, parsed.data);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    ok: true,
    id: out.id,
    pdf_storage_path: out.pdf_storage_path ?? null,
    signed_url: out.signed_url ?? null,
  });
}

/**
 * DELETE — Elimina la fila en `ci_contratos_express` y los objetos asociados en Storage (borrador y firmado si existen).
 */
export async function DELETE(_req: Request, context: { params: { id: string } }) {
  const gate = await requirePermisoRrhhObra();
  if (!gate.ok) return gate.response;

  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let row: ExpressRowPaths | null = null;
  const full = await admin.client
    .from('ci_contratos_express')
    .select('id,pdf_storage_path,pdf_firmado_storage_path')
    .eq('id', id)
    .maybeSingle();

  if (full.error && /column|does not exist|42703/i.test(full.error.message)) {
    const lite = await admin.client.from('ci_contratos_express').select('id,pdf_storage_path').eq('id', id).maybeSingle();
    if (lite.error) {
      return NextResponse.json({ error: lite.error.message }, { status: 500 });
    }
    if (!lite.data) {
      return NextResponse.json({ error: 'Contrato express no encontrado' }, { status: 404 });
    }
    row = lite.data as ExpressRowPaths;
  } else if (full.error) {
    return NextResponse.json({ error: full.error.message }, { status: 500 });
  } else if (!full.data) {
    return NextResponse.json({ error: 'Contrato express no encontrado' }, { status: 404 });
  } else {
    row = full.data as ExpressRowPaths;
  }

  const paths = [row.pdf_storage_path, row.pdf_firmado_storage_path].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  );

  if (paths.length > 0) {
    const { error: rmErr } = await admin.client.storage.from(BUCKET_CONTRATOS_OBREROS).remove(paths);
    if (rmErr) {
      console.warn('[contratos-express DELETE] storage remove', rmErr.message);
    }
  }

  const { error: delErr } = await admin.client.from('ci_contratos_express').delete().eq('id', id);
  if (delErr) {
    console.error('[contratos-express DELETE] row', delErr.message);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
