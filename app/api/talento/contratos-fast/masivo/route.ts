import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crearContratoExpress } from '@/lib/talento/crearContratoExpress';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';
import type { ConfigNominaTabuladorLike } from '@/lib/nomina/ingresoSemanalDesdeConfigNomina';
import { resolverConfigNominaPorCargo } from '@/lib/talento/resolverConfigNominaPorCargo';
import { recordarFaseTecnicaUsada, trimFaseTecnica } from '@/lib/talento/fasesTecnicasContrato';
import { normalizarFechaIngresoIso } from '@/lib/talento/parseCsvContratosExpress';

export const runtime = 'nodejs';
/** Generación de PDFs en lote puede tardar. */
export const maxDuration = 300;

const MAX_FILAS = 40;

const filaSchema = z.object({
  fila: z.number().int().positive().optional(),
  obrero_nombre: z.string().max(220).optional().nullable(),
  obrero_nombres: z.string().max(120).optional().nullable(),
  obrero_apellidos: z.string().max(120).optional().nullable(),
  obrero_cedula: z.string().min(1).max(32),
  obrero_direccion: z.string().max(500).optional().nullable(),
  /**
   * Remuneración semanal total en USD (columna Excel).
   * Se guarda tal cual y aparece en la cláusula BONO ESPECIAL del PDF.
   */
  remuneracion_semanal: z.coerce.number().nonnegative().optional().nullable(),
  /** Alias legacy: mismo significado que remuneracion_semanal en express. */
  bono_manual_usd: z.coerce.number().nonnegative().optional(),
  fecha_ingreso: z.string().max(40).optional().nullable(),
  /** Nombre de cargo en tabulador (`ci_config_nomina.cargo_nombre`). */
  cargo: z.string().max(160).optional().nullable(),
  oficio: z.string().max(160).optional().nullable(),
  /** Nivel genérico del listado de obra (ayuda a desambiguar Carpintero 1era/2da, etc.). */
  nivel_generico: z.coerce.number().int().min(1).max(9).optional().nullable(),
  config_nomina_id: z.string().uuid().optional().nullable(),
});

const bodySchema = z.object({
  proyecto_id: z.string().uuid(),
  /** Tabulador por defecto si una fila no trae cargo. */
  config_nomina_id: z.string().uuid().optional().nullable(),
  entidad_patrono_id: z.string().uuid().optional().nullable(),
  /** Fase técnica compartida (cláusula PRIMERA) para todo el lote. */
  objeto_contrato: z.string().max(4000).optional().nullable(),
  filas: z.array(filaSchema).min(1).max(MAX_FILAS),
});

/**
 * POST — Carga masiva de contratos express (mismo PDF/storage que contratos-fast).
 * Columnas típicas: nombres, apellidos, cédula, cargo, remuneración semanal, fecha de ingreso.
 * También listados de obra (AYUDANTE / CARPINTERO + nivel genérico).
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
      {
        error: `Datos inválidos (máx. ${MAX_FILAS} filas por lote)`,
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const {
    proyecto_id,
    config_nomina_id: defaultConfigId,
    entidad_patrono_id,
    objeto_contrato,
    filas,
  } = parsed.data;

  const { data: configs, error: cfgErr } = await admin.client
    .from('ci_config_nomina')
    .select('id,cargo_nombre,cargo_codigo,nivel_salarial,salario_base_mensual,cestaticket_mensual');
  if (cfgErr) {
    return NextResponse.json({ error: cfgErr.message }, { status: 500 });
  }

  const byId = new Map<string, ConfigNominaTabuladorLike & { id: string; cargo_nombre: string }>();
  const configsMatch: Array<{ id: string; cargo_nombre: string; nivel_salarial: number | null }> = [];
  for (const c of configs ?? []) {
    const row = c as {
      id: string;
      cargo_nombre?: string | null;
      cargo_codigo?: string | null;
      nivel_salarial?: number | null;
      salario_base_mensual?: unknown;
      cestaticket_mensual?: unknown;
    };
    const cfg = {
      id: row.id,
      cargo_nombre: (row.cargo_nombre ?? '').trim() || 'Sin nombre',
      cargo_codigo: row.cargo_codigo ?? null,
      nivel_salarial: row.nivel_salarial ?? null,
      salario_base_mensual: Number(row.salario_base_mensual) || 0,
      cestaticket_mensual: Number(row.cestaticket_mensual) || 0,
    };
    byId.set(row.id, cfg);
    configsMatch.push({
      id: row.id,
      cargo_nombre: cfg.cargo_nombre,
      nivel_salarial: cfg.nivel_salarial,
    });
  }

  if (defaultConfigId && !byId.has(defaultConfigId)) {
    return NextResponse.json(
      { error: 'El oficio / tabulador por defecto no existe en ci_config_nomina.' },
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

  type ResultadoFila =
    | { fila: number; ok: true; id: string; obrero: string; cedula: string; cargo?: string }
    | { fila: number; ok: false; error: string; obrero?: string; cedula?: string };

  const resultados: ResultadoFila[] = [];
  let okCount = 0;
  let failCount = 0;

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const filaN = f.fila ?? i + 1;
    const cedRaw = f.obrero_cedula;
    const ced = normCedulaToken(cedRaw);
    const nom = (f.obrero_nombres ?? '').trim();
    const ape = (f.obrero_apellidos ?? '').trim();
    const full = (f.obrero_nombre ?? '').trim() || (nom && ape ? `${nom} ${ape}` : '');

    if (!CEDULA_VE_NORMALIZADA_REGEX.test(ced)) {
      failCount++;
      resultados.push({
        fila: filaN,
        ok: false,
        error: 'Cédula inválida (Ej: V-12345678)',
        obrero: full || undefined,
        cedula: cedRaw,
      });
      continue;
    }

    if (full.length < 2) {
      failCount++;
      resultados.push({
        fila: filaN,
        ok: false,
        error: 'Faltan nombres/apellidos',
        cedula: ced,
      });
      continue;
    }

    const cargoLabel = (f.cargo ?? f.oficio ?? '').trim();
    let configId = defaultConfigId?.trim() || '';
    if (f.config_nomina_id && byId.has(f.config_nomina_id)) {
      configId = f.config_nomina_id;
    } else if (cargoLabel) {
      const matched = resolverConfigNominaPorCargo(cargoLabel, configsMatch, {
        nivelGenerico: f.nivel_generico ?? null,
      });
      if (matched) {
        configId = matched.id;
      } else if (defaultConfigId?.trim() && byId.has(defaultConfigId.trim())) {
        // Sin match: usar oficio por defecto del lote (si RRHH lo eligió).
        configId = defaultConfigId.trim();
      } else {
        failCount++;
        resultados.push({
          fila: filaN,
          ok: false,
          error: `Cargo «${cargoLabel}» no encontrado en el tabulador (revise Oficios y salarios o elija oficio por defecto arriba). Sugerencia: CARPINTERO/ALBAÑIL/OPERADOR/TOPOGRAFO/UTILITIS ya se emparejan automáticamente si el oficio existe en el tabulador.`,
          obrero: full,
          cedula: ced,
        });
        continue;
      }
    }

    if (!configId || !byId.has(configId)) {
      failCount++;
      resultados.push({
        fila: filaN,
        ok: false,
        error: 'Indique el cargo en la fila o elija un oficio por defecto arriba',
        obrero: full,
        cedula: ced,
      });
      continue;
    }

    const cfg = byId.get(configId)!;
    // Remuneración semanal del Excel = monto que va en BONO ESPECIAL del PDF (sin restar tabulador).
    let remuneracionSemanalUsd = 0;
    if (f.remuneracion_semanal != null && Number.isFinite(Number(f.remuneracion_semanal))) {
      remuneracionSemanalUsd = Math.max(0, Number(f.remuneracion_semanal));
    } else if (f.bono_manual_usd != null) {
      remuneracionSemanalUsd = Math.max(0, Number(f.bono_manual_usd) || 0);
    }

    const fechaNorm = normalizarFechaIngresoIso(f.fecha_ingreso ?? '');
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaNorm) ? fechaNorm : null;
    if ((f.fecha_ingreso ?? '').trim() && !fecha) {
      console.warn(
        `[contratos-fast/masivo] fila ${filaN}: fecha_ingreso no reconocida «${f.fecha_ingreso}»; se usará la fecha de hoy`,
      );
    }

    const result = await crearContratoExpress(admin.client, {
      proyecto_id,
      config_nomina_id: configId,
      obrero_nombres: nom || null,
      obrero_apellidos: ape || null,
      obrero_nombre: full,
      obrero_cedula: ced,
      obrero_direccion: f.obrero_direccion?.trim() || 'de este domicilio',
      estado_civil: 'Soltero',
      bono_manual_usd: remuneracionSemanalUsd,
      fecha_ingreso: fecha,
      objeto_contrato: objeto_contrato?.trim() || null,
      entidad_patrono_id: entidad_patrono_id ?? null,
      cargo_nombre_listado: cargoLabel || null,
      created_by: createdBy,
      incluir_signed_url: false,
      recordar_fase_tecnica: false,
    });

    if (!result.ok) {
      failCount++;
      resultados.push({
        fila: filaN,
        ok: false,
        error: result.error,
        obrero: full,
        cedula: ced,
      });
      continue;
    }

    okCount++;
    resultados.push({
      fila: filaN,
      ok: true,
      id: result.id,
      obrero: full,
      cedula: ced,
      cargo: cfg.cargo_nombre,
    });
  }

  const faseLote = trimFaseTecnica(objeto_contrato);
  if (okCount > 0 && faseLote) {
    await recordarFaseTecnicaUsada(admin.client, faseLote, { proyectoId: proyecto_id });
  }

  return NextResponse.json({
    ok: failCount === 0,
    creados: okCount,
    fallidos: failCount,
    total: filas.length,
    resultados,
  });
}
