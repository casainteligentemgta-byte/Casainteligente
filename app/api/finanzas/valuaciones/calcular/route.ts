import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  proyectoId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  porcentajeHonorarios?: number;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = (await req.json()) as Body;
    const { proyectoId, fechaInicio, fechaFin, porcentajeHonorarios } = body;

    if (!proyectoId || !fechaInicio || !fechaFin) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    // Materiales: compras del proyecto sin valuación (vista ci_compras → contabilidad_compras).
    const { data: compras, error: errorCompras } = await supabase
      .from('ci_compras')
      .select('monto_total')
      .eq('proyecto_id', proyectoId)
      .is('valuacion_delegada_id', null)
      .gte('fecha_factura', fechaInicio)
      .lte('fecha_factura', fechaFin);

    if (errorCompras) throw errorCompras;
    const totalMateriales = (compras ?? []).reduce(
      (sum, c) => sum + Number(c.monto_total ?? 0),
      0,
    );

    // Nómina: movimientos por obra en el rango (tabla ci_obra_nomina_pagos).
    const { data: nomina, error: errorNomina } = await supabase
      .from('ci_obra_nomina_pagos')
      .select('costo_hour_estimado, horas_trabajadas')
      .eq('obra_id', proyectoId)
      .is('valuacion_delegada_id', null)
      .gte('fecha_pago', fechaInicio)
      .lte('fecha_pago', fechaFin);

    if (errorNomina) throw errorNomina;
    const totalNomina = (nomina ?? []).reduce(
      (sum, n) =>
        sum + Number(n.costo_hour_estimado ?? 0) * Number(n.horas_trabajadas ?? 0),
      0,
    );

    const { count, error: errorCount } = await supabase
      .from('ci_valuaciones_delegadas')
      .select('*', { count: 'exact', head: true })
      .eq('proyecto_id', proyectoId);

    if (errorCount) throw errorCount;

    const proximoNumero = (count ?? 0) + 1;
    const pctHonorarios =
      porcentajeHonorarios != null && !Number.isNaN(Number(porcentajeHonorarios))
        ? Number(porcentajeHonorarios)
        : 10;

    return NextResponse.json({
      success: true,
      data: {
        numero_valuacion: proximoNumero,
        total_costo_materiales: totalMateriales,
        total_costo_nomina: totalNomina,
        porcentaje_honorarios: pctHonorarios,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al calcular la valuación.';
    console.error('[POST /api/finanzas/valuaciones/calcular]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
