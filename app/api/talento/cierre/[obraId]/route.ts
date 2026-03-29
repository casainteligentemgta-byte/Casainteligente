import { NextResponse } from 'next/server';
import { margenNetoProyecto } from '@/lib/talento/obra-math';
import { supabaseForRoute } from '@/lib/talento/supabase-route';

export async function GET(_req: Request, { params }: { params: { obraId: string } }) {
  const obraId = params.obraId?.trim();
  if (!obraId) {
    return NextResponse.json({ error: 'obraId requerido' }, { status: 400 });
  }

  const sb = supabaseForRoute();
  if (!sb.ok) return sb.response;
  const supabase = sb.client;

  const { data: obraRaw, error: oErr } = await supabase
    .from('ci_obras')
    .select('id,nombre,precio_venta_usd,estado')
    .eq('id', obraId)
    .single();

  const obra = obraRaw as {
    id: string;
    nombre: string;
    precio_venta_usd: number | null;
    estado: string;
  } | null;

  if (oErr || !obra) {
    return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });
  }

  const { data: mats } = await supabase.from('ci_materiales_obra').select('costo_usd').eq('obra_id', obraId);

  const sumaMateriales = ((mats ?? []) as { costo_usd: number | null }[]).reduce(
    (acc, r) => acc + Number(r.costo_usd ?? 0),
    0,
  );

  const { data: oes } = await supabase
    .from('ci_obra_empleados')
    .select('honorarios_acordados_usd,multas_acumuladas_usd')
    .eq('obra_id', obraId);

  let honorarios = 0;
  let multas = 0;
  for (const row of (oes ?? []) as { honorarios_acordados_usd: number | null; multas_acumuladas_usd: number | null }[]) {
    honorarios += Number(row.honorarios_acordados_usd ?? 0);
    multas += Number(row.multas_acumuladas_usd ?? 0);
  }

  const precioVenta = Number(obra.precio_venta_usd ?? 0);
  const margen = margenNetoProyecto({
    precioVentaUsd: precioVenta,
    sumaMaterialesUsd: sumaMateriales,
    honorariosEmpleadoUsd: honorarios,
    multasEmpleadoUsd: multas,
  });

  return NextResponse.json({
    obra_id: obra.id,
    nombre: obra.nombre,
    estado: obra.estado,
    precio_venta_usd: precioVenta,
    suma_materiales_usd: sumaMateriales,
    honorarios_empleados_usd: honorarios,
    multas_acumuladas_usd: multas,
    margen_neto_usd: Math.round(margen * 100) / 100,
  });
}
