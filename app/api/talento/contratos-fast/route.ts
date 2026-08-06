import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crearContratoExpress } from '@/lib/talento/crearContratoExpress';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';
import { normalizarFechaIngresoIso } from '@/lib/talento/parseCsvContratosExpress';

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
  objeto_contrato: z.string().max(4000).optional().nullable(),
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

  let createdBy: string | null = null;
  try {
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    createdBy = u.user?.id ?? null;
  } catch {
    /* sin sesión */
  }

  const result = await crearContratoExpress(admin.client, {
    ...parsed.data,
    created_by: createdBy,
  });

  if (!result.ok) {
    const status = /inválido|Falta|Indique|no se pudo cargar|no encontr/i.test(result.error) ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    id: result.id,
    expediente_label: result.expediente_label,
    pdf_storage_path: result.pdf_storage_path,
    signed_url: result.signed_url,
    signed_url_error: result.signed_url_error,
  });
}
