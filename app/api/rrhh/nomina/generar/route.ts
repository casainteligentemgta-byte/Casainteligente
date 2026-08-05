import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calcularReciboSemanal, InputCalculoRecibo } from '@/lib/nomina/motorCalculo';

export const dynamic = 'force-dynamic';

type EmpleadoRel = {
  id: string;
  nombre_completo: string | null;
  documento: string | null;
  estatus: string | null;
};

type ContratoConEmpleado = {
  id: string;
  empleado_id: string;
  cargo_nombre: string | null;
  sueldo_semanal_usd: number | string | null;
  ci_empleados: EmpleadoRel | EmpleadoRel[];
};

function unwrapEmpleado(rel: EmpleadoRel | EmpleadoRel[]): EmpleadoRel {
  return Array.isArray(rel) ? rel[0] : rel;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // Validar sesión
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      proyectoId, 
      entidadId,
      numeroSemana, 
      fechaInicio, 
      fechaFin, 
      tasaBcv 
    } = body;

    if (!proyectoId || !numeroSemana || !fechaInicio || !fechaFin || !tasaBcv) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    // 1. Buscar a los trabajadores asignados a este proyecto
    const { data: contratosRaw, error: errContratos } = await supabase
      .from('ci_contratos_empleado_obra')
      .select(`
        id,
        empleado_id,
        cargo_nombre,
        sueldo_semanal_usd,
        ci_empleados!inner(id, nombre_completo, documento, estatus)
      `)
      .eq('obra_id', proyectoId)
      .eq('ci_empleados.estatus', 'asignado')
      .is('fecha_fin_real', null); // Contratos activos

    const contratos = (contratosRaw ?? []) as unknown as ContratoConEmpleado[];

    if (errContratos || contratos.length === 0) {
      return NextResponse.json({ 
        error: 'No se encontraron contratos activos en esta obra.' 
      }, { status: 404 });
    }

    // 2. Crear el Período Borrador
    const desc = `Semana ${numeroSemana}`;
    const { data: periodo, error: errPeriodo } = await supabase
      .from('ci_nomina_periodos')
      .insert({
        proyecto_id: proyectoId,
        entidad_id: entidadId || null,
        numero_semana: numeroSemana,
        descripcion: desc,
        tipo_nomina: 'semanal',
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tasa_bcv_aplicada: tasaBcv,
        estado: 'borrador'
      })
      .select('id')
      .single();

    if (errPeriodo || !periodo) {
      return NextResponse.json({ error: 'Error creando período: ' + errPeriodo?.message }, { status: 500 });
    }

    // 3. Procesar a cada trabajador
    let totalAsignaciones = 0;
    let totalDeducciones = 0;
    let totalNeto = 0;
    let totalNetoUsd = 0;

    for (const c of contratos) {
      // Por simplicidad del MVP de generación masiva, asumimos asistencia perfecta (5 días)
      // En una Fase posterior, aquí se consultaría la tabla rrhh_asistencias_diarias
      const diasLaborados = 5;
      const empleado = unwrapEmpleado(c.ci_empleados);
      
      const input: InputCalculoRecibo = {
        empleadoId: c.empleado_id,
        cargo: c.cargo_nombre || 'Ayudante',
        nivelTabulador: 2, // Hardcodeado por ahora. En un escenario real vendría del contrato.
        diasLaborados,
        metaIntegralSemanalUsd: Number(c.sueldo_semanal_usd) || 100, // Meta de contrato, default 100
        tasaBcv: Number(tasaBcv)
      };

      const calculo = calcularReciboSemanal(input);

      // Insertar Recibo
      const { data: recibo, error: errRecibo } = await supabase
        .from('ci_nomina_recibos')
        .insert({
          periodo_id: periodo.id,
          empleado_id: c.empleado_id,
          contrato_id: c.id,
          empleado_nombre: empleado?.nombre_completo ?? null,
          empleado_cedula: empleado?.documento ?? null,
          empleado_cargo: c.cargo_nombre,
          dias_laborados: diasLaborados,
          salario_base_mensual: calculo.salario_base_bs * 4,
          total_asignaciones: calculo.salario_base_bs + calculo.cestaticket_bs + calculo.bono_complementario_bs,
          total_deducciones: calculo.total_deducciones_ley_bs,
          total_neto: calculo.total_neto_pagado_bs,
          total_neto_usd: calculo.total_neto_pagado_usd,
          meta_integral_acordada_usd: input.metaIntegralSemanalUsd
        })
        .select('id')
        .single();

      if (!errRecibo && recibo) {
        // Insertar Conceptos de ese Recibo
        const conceptos = [
          { recibo_id: recibo.id, tipo: 'asignacion', codigo_concepto: 'SAL_BAS', descripcion: 'Salario Base Tabulador', cantidad: diasLaborados + 1, monto: calculo.salario_base_bs },
          { recibo_id: recibo.id, tipo: 'deduccion', codigo_concepto: 'SSO', descripcion: 'Retención SSO (4%)', cantidad: 1, monto: calculo.sso_bs },
          { recibo_id: recibo.id, tipo: 'deduccion', codigo_concepto: 'SPF', descripcion: 'Retención SPF (0.5%)', cantidad: 1, monto: calculo.spf_bs },
          { recibo_id: recibo.id, tipo: 'deduccion', codigo_concepto: 'FAOV', descripcion: 'Retención FAOV (1%)', cantidad: 1, monto: calculo.faov_bs },
          { recibo_id: recibo.id, tipo: 'asignacion', codigo_concepto: 'CESTA', descripcion: 'Cestaticket Oficial', cantidad: 1, monto: calculo.cestaticket_bs },
          { recibo_id: recibo.id, tipo: 'asignacion', codigo_concepto: 'BONO', descripcion: 'Bono Complementario Asistencia/Producción', cantidad: 1, monto: calculo.bono_complementario_bs }
        ];

        await supabase.from('ci_nomina_conceptos').insert(conceptos);

        totalAsignaciones += (calculo.salario_base_bs + calculo.cestaticket_bs + calculo.bono_complementario_bs);
        totalDeducciones += calculo.total_deducciones_ley_bs;
        totalNeto += calculo.total_neto_pagado_bs;
        totalNetoUsd += calculo.total_neto_pagado_usd;
      }
    }

    // Actualizar Totales del Período
    await supabase.from('ci_nomina_periodos').update({
      total_asignaciones: totalAsignaciones,
      total_deducciones: totalDeducciones,
      total_neto: totalNeto,
      total_neto_usd: totalNetoUsd
    }).eq('id', periodo.id);

    return NextResponse.json({ ok: true, periodoId: periodo.id, totalObreros: contratos.length }, { status: 201 });

  } catch (error: any) {
    console.error('Error generando nómina:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}