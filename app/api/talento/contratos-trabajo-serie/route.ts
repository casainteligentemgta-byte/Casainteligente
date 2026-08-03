import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generarContratoTrabajoObrero } from '@/lib/talento/generarContratoTrabajoObrero';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';

export const runtime = 'nodejs';
/** PDF en serie es pesado; limitar por request para no saturar serverless. */
export const maxDuration = 300;

const filaSchema = z.object({
  proyecto_id: z.string().uuid().optional().nullable(),
  config_nomina_id: z.string().uuid().optional().nullable(),
  obrero_nombre: z.string().max(220).optional().nullable(),
  obrero_nombres: z.string().max(120).optional().nullable(),
  obrero_apellidos: z.string().max(120).optional().nullable(),
  obrero_cedula: z.preprocess(
    (v) => normCedulaToken(String(v ?? '')),
    z.string().regex(CEDULA_VE_NORMALIZADA_REGEX, 'Cédula inválida'),
  ),
  obrero_direccion: z.string().max(500).optional().nullable(),
  bono_manual_usd: z.coerce.number().nonnegative().optional().default(0),
  entidad_patrono_id: z.string().uuid().optional().nullable(),
  fecha_ingreso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  objeto_contrato: z.string().max(2000).optional().nullable(),
  jornada_trabajo: z.string().max(40).optional().nullable(),
  nacionalidad: z.string().max(80).optional().nullable(),
  estado_civil: z.string().max(80).optional().nullable(),
  horario_semanal_texto: z.string().max(2500).optional().nullable(),
  obrero_municipio_residencia: z.string().max(120).optional().nullable(),
  obrero_estado_residencia: z.string().max(120).optional().nullable(),
  /** Solo para el reporte de respuesta */
  fila_excel: z.number().int().positive().optional().nullable(),
});

const bodySchema = z.object({
  /** Defaults aplicados a cada fila si no trae proyecto/cargo. */
  defaults: z.object({
    proyecto_id: z.string().uuid(),
    config_nomina_id: z.string().uuid(),
    entidad_patrono_id: z.string().uuid().optional().nullable(),
    fecha_ingreso: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    jornada_trabajo: z.string().max(40).optional().nullable(),
    horario_semanal_texto: z.string().max(2500).optional().nullable(),
  }),
  filas: z.array(filaSchema).min(1).max(40),
});

/**
 * POST — Genera contratos de trabajo (obrero) en serie a partir de filas
 * (típicamente extraídas de Excel). Procesa de forma secuencial.
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

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
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

  const { defaults, filas } = parsed.data;
  const resultados: Array<{
    fila_excel: number | null;
    cedula: string;
    ok: boolean;
    id?: string;
    signed_url?: string | null;
    error?: string;
  }> = [];

  for (const fila of filas) {
    const nom = (fila.obrero_nombres ?? '').trim();
    const ape = (fila.obrero_apellidos ?? '').trim();
    const full = (fila.obrero_nombre ?? '').trim();
    if (!(nom && ape) && full.length < 2) {
      resultados.push({
        fila_excel: fila.fila_excel ?? null,
        cedula: fila.obrero_cedula,
        ok: false,
        error: 'Falta nombre del trabajador',
      });
      continue;
    }

    const out = await generarContratoTrabajoObrero(
      admin.client,
      {
        proyecto_id: (fila.proyecto_id ?? defaults.proyecto_id).trim(),
        config_nomina_id: (fila.config_nomina_id ?? defaults.config_nomina_id).trim(),
        obrero_nombre: full || null,
        obrero_nombres: nom || null,
        obrero_apellidos: ape || null,
        obrero_cedula: fila.obrero_cedula,
        obrero_direccion: fila.obrero_direccion,
        bono_manual_usd: fila.bono_manual_usd ?? 0,
        entidad_patrono_id: fila.entidad_patrono_id ?? defaults.entidad_patrono_id,
        fecha_ingreso: fila.fecha_ingreso ?? defaults.fecha_ingreso,
        objeto_contrato: fila.objeto_contrato,
        jornada_trabajo: fila.jornada_trabajo ?? defaults.jornada_trabajo,
        nacionalidad: fila.nacionalidad,
        estado_civil: fila.estado_civil,
        horario_semanal_texto: fila.horario_semanal_texto ?? defaults.horario_semanal_texto,
        obrero_municipio_residencia: fila.obrero_municipio_residencia,
        obrero_estado_residencia: fila.obrero_estado_residencia,
      },
      { createdBy },
    );

    if (!out.ok) {
      resultados.push({
        fila_excel: fila.fila_excel ?? null,
        cedula: fila.obrero_cedula,
        ok: false,
        error: out.error,
      });
      continue;
    }

    resultados.push({
      fila_excel: fila.fila_excel ?? null,
      cedula: fila.obrero_cedula,
      ok: true,
      id: out.id,
      signed_url: out.signed_url,
    });
  }

  const okCount = resultados.filter((r) => r.ok).length;
  const failCount = resultados.length - okCount;

  return NextResponse.json({
    ok: failCount === 0,
    generados: okCount,
    fallidos: failCount,
    resultados,
  });
}
