/**
 * Puente post-contrato → 1ª semana de nómina (periodo borrador + recibo).
 * No requiere migración: usa `ci_nomina_periodos` / `ci_nomina_recibos`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { calcularReciboSemanal, type InputCalculoRecibo } from '@/lib/nomina/motorCalculo';
import { tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';

export type RangoSemanaIso = {
  fechaInicio: string;
  fechaFin: string;
  numeroSemana: number;
  descripcion: string;
};

/** Semana laboral lun–dom (ISO) en zona local del servidor. */
export function rangoSemanaLaboral(ref: Date = new Date()): RangoSemanaIso {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDay(); // 0=dom … 6=sáb
  const diffLunes = day === 0 ? -6 : 1 - day;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diffLunes);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const y = lunes.getFullYear();
  const oneJan = new Date(y, 0, 1);
  const week = Math.ceil(((lunes.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);

  const iso = (x: Date) => {
    const mm = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${x.getFullYear()}-${mm}-${dd}`;
  };

  return {
    fechaInicio: iso(lunes),
    fechaFin: iso(domingo),
    numeroSemana: week,
    descripcion: `Semana ${week} (${iso(lunes)} — ${iso(domingo)})`,
  };
}

export type IncluirNominaInput = {
  empleadoId: string;
  /** Opcional; si falta se usa proyecto_modulo_id del empleado. */
  proyectoId?: string | null;
  tasaBcv?: number | null;
  diasLaborados?: number;
  metaIntegralSemanalUsd?: number | null;
};

export type IncluirNominaOk = {
  ok: true;
  periodoId: string;
  reciboId: string;
  yaExistia: boolean;
  fechaInicio: string;
  fechaFin: string;
};

export type IncluirNominaErr = { ok: false; error: string; status: number };

/**
 * Asegura estatus asignado, periodo borrador de la semana actual y recibo del obrero.
 */
export async function incluirEmpleadoEnNominaSemanal(
  supabase: SupabaseClient,
  input: IncluirNominaInput,
): Promise<IncluirNominaOk | IncluirNominaErr> {
  const empleadoId = input.empleadoId.trim();
  if (!empleadoId) return { ok: false, error: 'empleadoId requerido', status: 400 };

  const { data: emp, error: empErr } = await supabase
    .from('ci_empleados')
    .select(
      'id,nombre_completo,documento,cedula,cargo_nombre,cargo_nivel,proyecto_modulo_id,estatus,estado',
    )
    .eq('id', empleadoId)
    .maybeSingle();

  if (empErr) return { ok: false, error: empErr.message, status: 500 };
  if (!emp) return { ok: false, error: 'Expediente no encontrado', status: 404 };

  const row = emp as {
    id: string;
    nombre_completo: string | null;
    documento: string | null;
    cedula: string | null;
    cargo_nombre: string | null;
    cargo_nivel: number | null;
    proyecto_modulo_id: string | null;
    estatus: string | null;
    estado: string | null;
  };

  const proyectoId = (input.proyectoId ?? row.proyecto_modulo_id ?? '').trim();
  if (!proyectoId) {
    return {
      ok: false,
      error: 'El expediente no tiene obra asignada (proyecto_modulo_id).',
      status: 409,
    };
  }

  const tasa =
    input.tasaBcv != null && Number(input.tasaBcv) > 0
      ? Number(input.tasaBcv)
      : tasaBcvVesPorUsdFromEnv();
  if (tasa == null || !(tasa > 0)) {
    return {
      ok: false,
      error:
        'Falta tasa BCV (pase tasaBcv o configure NEXT_PUBLIC_TASA_BCV_VES_POR_USD).',
      status: 400,
    };
  }

  const ahora = new Date().toISOString();
  await supabase
    .from('ci_empleados')
    .update({ estatus: 'asignado', estado_proceso: 'contratado_activo', updated_at: ahora } as never)
    .eq('id', empleadoId);

  const { error: obraErr } = await supabase.from('ci_obra_empleados').upsert(
    {
      obra_id: proyectoId,
      empleado_id: empleadoId,
      honorarios_acordados_usd: 0,
      multas_acumuladas_usd: 0,
    } as never,
    { onConflict: 'obra_id,empleado_id' },
  );
  if (obraErr) {
    console.warn('[incluirEmpleadoEnNominaSemanal] ci_obra_empleados:', obraErr.message);
  }

  // Contrato obra activo (si existe) para meta USD / cargo.
  let ctr: unknown = null;
  {
    const q1 = await supabase
      .from('ci_contratos_empleado_obra')
      .select('id,cargo_nombre,sueldo_semanal_usd,monto_acordado_usd,fecha_fin_real')
      .eq('empleado_id', empleadoId)
      .eq('obra_id', proyectoId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (q1.error && /column|42703|schema cache/i.test(q1.error.message)) {
      const q2 = await supabase
        .from('ci_contratos_empleado_obra')
        .select('id,monto_acordado_usd')
        .eq('empleado_id', empleadoId)
        .eq('obra_id', proyectoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      ctr = q2.data;
    } else {
      const rows = (q1.data ?? []) as { fecha_fin_real?: string | null }[];
      ctr = rows.find((r) => !r.fecha_fin_real) ?? rows[0] ?? null;
    }
  }

  const contrato = ctr as {
    id: string;
    cargo_nombre?: string | null;
    sueldo_semanal_usd?: number | string | null;
    monto_acordado_usd?: number | string | null;
  } | null;

  const meta =
    input.metaIntegralSemanalUsd != null && Number(input.metaIntegralSemanalUsd) > 0
      ? Number(input.metaIntegralSemanalUsd)
      : Number(contrato?.sueldo_semanal_usd) > 0
        ? Number(contrato?.sueldo_semanal_usd)
        : Number(contrato?.monto_acordado_usd) > 0
          ? Number(contrato?.monto_acordado_usd)
          : 100;

  const cargo =
    (contrato?.cargo_nombre ?? row.cargo_nombre ?? '').trim() || 'Ayudante';
  const nivel =
    row.cargo_nivel != null && Number(row.cargo_nivel) >= 1 && Number(row.cargo_nivel) <= 9
      ? Math.round(Number(row.cargo_nivel))
      : 2;
  const dias = input.diasLaborados != null ? Math.max(0, Math.min(6, Number(input.diasLaborados))) : 5;

  const semana = rangoSemanaLaboral();

  let periodoId: string | null = null;
  const { data: periodoExist } = await supabase
    .from('ci_nomina_periodos')
    .select('id,estado')
    .eq('proyecto_id', proyectoId)
    .eq('fecha_inicio', semana.fechaInicio)
    .eq('fecha_fin', semana.fechaFin)
    .eq('tipo_nomina', 'semanal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (periodoExist) {
    periodoId = (periodoExist as { id: string }).id;
    const est = String((periodoExist as { estado?: string }).estado ?? '');
    if (est && est !== 'borrador') {
      return {
        ok: false,
        error: `El periodo de esta semana ya está en estado «${est}»; no se puede agregar recibos.`,
        status: 409,
      };
    }
  } else {
    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('entidad_id,nombre')
      .eq('id', proyectoId)
      .maybeSingle();
    const entidadId = (proy as { entidad_id?: string | null } | null)?.entidad_id ?? null;
    const obraNom = ((proy as { nombre?: string | null } | null)?.nombre ?? '').trim();

    const { data: nuevo, error: perErr } = await supabase
      .from('ci_nomina_periodos')
      .insert({
        proyecto_id: proyectoId,
        entidad_id: entidadId,
        numero_semana: semana.numeroSemana,
        descripcion: obraNom
          ? `${semana.descripcion} · ${obraNom}`
          : semana.descripcion,
        tipo_nomina: 'semanal',
        fecha_inicio: semana.fechaInicio,
        fecha_fin: semana.fechaFin,
        tasa_bcv_aplicada: tasa,
        estado: 'borrador',
      } as never)
      .select('id')
      .single();

    if (perErr || !nuevo) {
      return {
        ok: false,
        error: perErr?.message ?? 'No se pudo crear el periodo de nómina',
        status: 500,
      };
    }
    periodoId = (nuevo as { id: string }).id;
  }

  const { data: reciboExist } = await supabase
    .from('ci_nomina_recibos')
    .select('id')
    .eq('periodo_id', periodoId)
    .eq('empleado_id', empleadoId)
    .maybeSingle();

  if (reciboExist) {
    return {
      ok: true,
      periodoId,
      reciboId: (reciboExist as { id: string }).id,
      yaExistia: true,
      fechaInicio: semana.fechaInicio,
      fechaFin: semana.fechaFin,
    };
  }

  const calcInput: InputCalculoRecibo = {
    empleadoId,
    cargo,
    nivelTabulador: nivel,
    diasLaborados: dias,
    metaIntegralSemanalUsd: meta,
    tasaBcv: tasa,
  };
  const calculo = calcularReciboSemanal(calcInput);

  const { data: recibo, error: recErr } = await supabase
    .from('ci_nomina_recibos')
    .insert({
      periodo_id: periodoId,
      empleado_id: empleadoId,
      contrato_id: contrato?.id ?? null,
      empleado_nombre: (row.nombre_completo ?? '').trim() || 'Sin nombre',
      empleado_cedula: (row.cedula ?? row.documento ?? '').trim() || null,
      empleado_cargo: cargo,
      dias_laborados: dias,
      salario_base_mensual: calculo.salario_base_bs * 4,
      total_asignaciones:
        calculo.salario_base_bs + calculo.cestaticket_bs + calculo.bono_complementario_bs,
      total_deducciones: calculo.total_deducciones_ley_bs,
      total_neto: calculo.total_neto_pagado_bs,
      total_neto_usd: calculo.total_neto_pagado_usd,
      meta_integral_acordada_usd: meta,
    } as never)
    .select('id')
    .single();

  if (recErr || !recibo) {
    return {
      ok: false,
      error: recErr?.message ?? 'No se pudo crear el recibo',
      status: 500,
    };
  }

  const reciboId = (recibo as { id: string }).id;
  const conceptos = [
    {
      recibo_id: reciboId,
      tipo: 'asignacion',
      codigo_concepto: 'SAL_BAS',
      descripcion: 'Salario Base Tabulador',
      cantidad: dias + 1,
      monto: calculo.salario_base_bs,
    },
    {
      recibo_id: reciboId,
      tipo: 'deduccion',
      codigo_concepto: 'SSO',
      descripcion: 'Retención SSO (4%)',
      cantidad: 1,
      monto: calculo.sso_bs,
    },
    {
      recibo_id: reciboId,
      tipo: 'deduccion',
      codigo_concepto: 'SPF',
      descripcion: 'Retención SPF (0.5%)',
      cantidad: 1,
      monto: calculo.spf_bs,
    },
    {
      recibo_id: reciboId,
      tipo: 'deduccion',
      codigo_concepto: 'FAOV',
      descripcion: 'Retención FAOV (1%)',
      cantidad: 1,
      monto: calculo.faov_bs,
    },
    {
      recibo_id: reciboId,
      tipo: 'asignacion',
      codigo_concepto: 'CESTA',
      descripcion: 'Cestaticket Oficial',
      cantidad: 1,
      monto: calculo.cestaticket_bs,
    },
    {
      recibo_id: reciboId,
      tipo: 'asignacion',
      codigo_concepto: 'BONO',
      descripcion: 'Bono Complementario Asistencia/Producción',
      cantidad: 1,
      monto: calculo.bono_complementario_bs,
    },
  ];
  await supabase.from('ci_nomina_conceptos').insert(conceptos as never);

  // Recalcular totales del periodo (suma simple de recibos).
  const { data: recibos } = await supabase
    .from('ci_nomina_recibos')
    .select('total_asignaciones,total_deducciones,total_neto,total_neto_usd')
    .eq('periodo_id', periodoId);

  let ta = 0;
  let td = 0;
  let tn = 0;
  let tnu = 0;
  for (const r of recibos ?? []) {
    ta += Number((r as { total_asignaciones?: number }).total_asignaciones) || 0;
    td += Number((r as { total_deducciones?: number }).total_deducciones) || 0;
    tn += Number((r as { total_neto?: number }).total_neto) || 0;
    tnu += Number((r as { total_neto_usd?: number }).total_neto_usd) || 0;
  }
  await supabase
    .from('ci_nomina_periodos')
    .update({
      total_asignaciones: ta,
      total_deducciones: td,
      total_neto: tn,
      total_neto_usd: tnu,
      tasa_bcv_aplicada: tasa,
      updated_at: ahora,
    } as never)
    .eq('id', periodoId);

  return {
    ok: true,
    periodoId,
    reciboId,
    yaExistia: false,
    fechaInicio: semana.fechaInicio,
    fechaFin: semana.fechaFin,
  };
}
