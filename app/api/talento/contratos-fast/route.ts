import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  cargarPropsContratoObreroPdfExpress,
  type ContratoExpressManualInput,
} from '@/lib/talento/contratoObreroPdfContext';
import {
  BUCKET_CONTRATOS_OBREROS,
  signedUrlContratoLaboralBucket,
} from '@/lib/talento/contratoLaboralRegistroStorage';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';

export const runtime = 'nodejs';

const postBodySchema = z.object({
  proyecto_id: z.string().uuid(),
  config_nomina_id: z.string().uuid(),
  /** Preferir `obrero_nombres` + `obrero_apellidos`; si no vienen, se usa `obrero_nombre` (compatibilidad). */
  obrero_nombre: z.string().max(220).optional().nullable(),
  obrero_nombres: z.string().min(2).max(120).optional().nullable(),
  obrero_apellidos: z.string().min(2).max(120).optional().nullable(),
  obrero_cedula: z.preprocess(
    (v) => normCedulaToken(String(v ?? '')),
    z.string().regex(CEDULA_VE_NORMALIZADA_REGEX, 'Formato de cédula inválido (Ej: V-12345678)'),
  ),
  obrero_direccion: z.string().max(500).optional().nullable(),
  /** Bono variable en USD; en bolívares se liquida al pagar con la tasa oficial del BCV del día (p. ej. viernes). */
  bono_manual_usd: z.coerce.number().nonnegative().default(0),
  /** Si se envía, sustituye a `ci_proyectos.entidad_id` como patrono del PDF (razón social, RM, domicilio). */
  entidad_patrono_id: z.string().uuid().optional().nullable(),
  fecha_ingreso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  objeto_contrato: z.string().max(2000).optional().nullable(),
  jornada_trabajo: z.enum(['DIURNA', 'NOCTURNA', 'MIXTA', 'diurna', 'nocturna', 'mixta']).optional().nullable(),
  tipo_contrato: z.string().max(120).optional().nullable(),
  nacionalidad: z.string().max(80).optional().nullable(),
  estado_civil: z.string().max(80).optional().nullable(),
  /** Detalle de horario semanal (cláusula CUARTA del PDF). */
  horario_semanal_texto: z.string().max(2500).optional().nullable(),
  /** Municipio y estado de residencia del trabajador (comparecencia en PDF). */
  obrero_municipio_residencia: z.string().max(120).optional().nullable(),
  obrero_estado_residencia: z.string().max(120).optional().nullable(),
}).superRefine((data, ctx) => {
  const nom = (data.obrero_nombres ?? '').trim();
  const ape = (data.obrero_apellidos ?? '').trim();
  const full = (data.obrero_nombre ?? '').trim();
  if ((nom && ape) || full.length >= 2) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Indique nombres y apellidos del trabajador (o un nombre completo en obrero_nombre).',
    path: ['obrero_nombres'],
  });
});

function nombreCompletoObreroDesdeBody(parsed: z.infer<typeof postBodySchema>): string {
  const nom = (parsed.obrero_nombres ?? '').trim();
  const ape = (parsed.obrero_apellidos ?? '').trim();
  if (nom && ape) return `${nom} ${ape}`.trim();
  const legacy = (parsed.obrero_nombre ?? '').trim();
  return legacy;
}

function manualDesdeBody(
  parsed: z.infer<typeof postBodySchema>,
  fechaFirmaIso: string,
): ContratoExpressManualInput {
  return {
    obreroNombre: nombreCompletoObreroDesdeBody(parsed),
    obreroCedula: parsed.obrero_cedula.trim(),
    obreroDireccion: parsed.obrero_direccion?.trim() || null,
    nacionalidad: parsed.nacionalidad?.trim() || null,
    estadoCivil: parsed.estado_civil?.trim() || null,
    fechaIngreso: parsed.fecha_ingreso?.trim() || fechaFirmaIso,
    fechaFirmaContratoIso: fechaFirmaIso,
    objetoContrato: parsed.objeto_contrato?.trim() || null,
    jornadaTrabajo: parsed.jornada_trabajo?.trim() || null,
    tipoContrato: parsed.tipo_contrato?.trim() || null,
    horarioSemanalTexto: parsed.horario_semanal_texto?.trim() || null,
    obreroMunicipioResidencia: parsed.obrero_municipio_residencia?.trim() || null,
    obreroEstadoResidencia: parsed.obrero_estado_residencia?.trim() || null,
    bonoManualUsd: parsed.bono_manual_usd,
  };
}

/**
 * POST — Genera PDF estructurado de contrato obrero sin expediente, lo sube a `contratos_obreros` y registra en `ci_contratos_express`.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const fechaFirmaIso =
    body.fecha_ingreso?.trim() ||
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

  const manual = manualDesdeBody(body, fechaFirmaIso);

  const loaded = await cargarPropsContratoObreroPdfExpress(
    admin.client,
    body.proyecto_id,
    body.config_nomina_id,
    manual,
    { entidadPatronoId: body.entidad_patrono_id?.trim() || null },
  );
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: 400 });
  }

  const expressId = crypto.randomUUID();
  const expedienteLabel = `EXPRESS-${expressId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  let buf: Buffer;
  try {
    const node = createElement(ContratoObreroPDF, {
      ...loaded.props,
      expedienteId: expedienteLabel,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    buf = Buffer.from(await blob.arrayBuffer());
  } catch (e) {
    console.error('[contratos-fast] pdf', e);
    return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 });
  }

  const storagePath = `express/${expressId}/contrato-estructurado.pdf`;
  const { error: upErr } = await admin.client.storage.from(BUCKET_CONTRATOS_OBREROS).upload(storagePath, buf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upErr) {
    console.error('[contratos-fast] storage', upErr.message);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  let createdBy: string | null = null;
  try {
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    createdBy = u.user?.id ?? null;
  } catch {
    /* sin sesión */
  }

  const { data: nomSnap } = await admin.client
    .from('ci_config_nomina')
    .select('cargo_nombre,salario_base_mensual')
    .eq('id', body.config_nomina_id)
    .maybeSingle();
  const snap = nomSnap as { cargo_nombre?: string | null; salario_base_mensual?: unknown } | null;
  const salSnap = snap?.salario_base_mensual != null ? Number(snap.salario_base_mensual) : null;

  const obreroNombreCompleto = nombreCompletoObreroDesdeBody(body);

  const horarioVal =
    (body.horario_semanal_texto?.trim() || loaded.props.parametros.horarioSemanal?.trim() || null) as string | null;

  const baseRow = {
    id: expressId,
    proyecto_id: body.proyecto_id,
    config_nomina_id: body.config_nomina_id,
    obrero_nombre: obreroNombreCompleto,
    obrero_cedula: body.obrero_cedula.trim(),
    obrero_direccion: body.obrero_direccion?.trim() || null,
    salario_base_mensual_snapshot: salSnap != null && Number.isFinite(salSnap) ? salSnap : null,
    cargo_nombre_snapshot: snap?.cargo_nombre?.trim() || null,
    pdf_storage_path: storagePath,
    created_by: createdBy,
  };

  /** Reintentos: columnas 122/126, y sin `created_by` si la FK a `auth.users` falla (sesión distinta de proyecto, etc.). */
  const primaryVariants: Record<string, unknown>[] = [
    { ...baseRow, bono_manual_usd: body.bono_manual_usd, horario_semanal_texto: horarioVal },
    { ...baseRow, bono_manual_ves: body.bono_manual_usd, horario_semanal_texto: horarioVal },
    { ...baseRow, bono_manual_usd: body.bono_manual_usd },
    { ...baseRow, bono_manual_ves: body.bono_manual_usd },
  ];
  const sinCreatedBy = primaryVariants.map((p) => {
    const { created_by: _c, ...rest } = p;
    return rest;
  });
  const stripSnapshots = (p: Record<string, unknown>) => {
    const { salario_base_mensual_snapshot: _s, cargo_nombre_snapshot: _cg, ...rest } = p;
    return rest;
  };
  const withSnapshots = [...primaryVariants, ...sinCreatedBy];
  const insertVariants: Record<string, unknown>[] = [...withSnapshots, ...withSnapshots.map(stripSnapshots)];

  function isSchemaColumnError(msg: string): boolean {
    return (
      /column .* does not exist|42703|Could not find the .* column/i.test(msg) ||
      /horario_semanal_texto|bono_manual_usd|bono_manual_ves/i.test(msg)
    );
  }

  function isCreatedByFkError(msg: string): boolean {
    return /created_by/i.test(msg) && /foreign key|fkey|violates|auth\.users/i.test(msg);
  }

  let insErr: { message: string } | null = null;
  for (const payload of insertVariants) {
    const { data, error } = await admin.client
      .from('ci_contratos_express')
      .insert(payload as never)
      .select('id')
      .maybeSingle();
    if (!error && data && (data as { id?: string }).id === expressId) {
      insErr = null;
      break;
    }
    insErr = error ?? { message: 'El INSERT no devolvió el id del contrato express.' };
    const msg = insErr.message;
    if (isSchemaColumnError(msg) || isCreatedByFkError(msg)) {
      continue;
    }
    break;
  }

  if (!insErr) {
    const { data: rowOk, error: rowErr } = await admin.client
      .from('ci_contratos_express')
      .select('id')
      .eq('id', expressId)
      .maybeSingle();
    if (rowErr || !rowOk) {
      console.error('[contratos-fast] verify row', rowErr?.message);
      return NextResponse.json(
        {
          error:
            'No se pudo confirmar el registro en ci_contratos_express tras el INSERT. Revise RLS/triggers o que la URL de Supabase coincida con la del service_role.',
          hint: rowErr?.message,
        },
        { status: 500 },
      );
    }
  }

  if (insErr) {
    console.error('[contratos-fast] insert', insErr.message);
    return NextResponse.json(
      {
        error: insErr.message.includes('relation')
          ? 'Ejecute la migración 118_ci_contratos_express en Supabase.'
          : /bono_manual_usd|bono_manual_ves|column .* does not exist/i.test(insErr.message)
            ? 'Revise migraciones 118 y 122 (bono: columna bono_manual_usd o bono_manual_ves).'
            : /horario_semanal_texto|column .* does not exist/i.test(insErr.message)
              ? 'Ejecute la migración 126_ci_contratos_express_horario_semanal_texto en Supabase.'
              : insErr.message,
      },
      { status: 500 },
    );
  }

  const signed = await signedUrlContratoLaboralBucket(admin.client, storagePath, 3600);

  return NextResponse.json({
    id: expressId,
    expediente_label: expedienteLabel,
    pdf_storage_path: storagePath,
    signed_url: 'url' in signed ? signed.url : null,
    signed_url_error: 'error' in signed ? signed.error : null,
  });
}
