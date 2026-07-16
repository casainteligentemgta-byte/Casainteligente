import { NextResponse } from 'next/server';
import { calculateLaborCost } from '@/lib/finanzas/calculateLaborCost';
import { createClient } from '@/lib/supabase/server';

type ProyectoRow = {
  id: string;
  tipo_proyecto?: string | null;
  estado?: string | null;
  obra_estado_legacy?: string | null;
};

function proyectoActivo(p: ProyectoRow): boolean {
  const tipo = (p.tipo_proyecto ?? 'integral').toLowerCase();
  if (tipo === 'talento') {
    const leg = (p.obra_estado_legacy ?? 'activa').toLowerCase();
    return leg === 'activa';
  }
  const e = (p.estado ?? '').toLowerCase();
  return e === 'ejecucion' || e === 'levantamiento' || e === 'presupuestado';
}

/**
 * Recalcula `obra_presupuesto_mano_obra_ves` en proyectos activos según `calculateLaborCost` y tabulador `ci_config_nomina`.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: proyectos, error: e0 } = await supabase
      .from('ci_proyectos')
      .select('id,tipo_proyecto,estado,obra_estado_legacy');
    if (e0) {
      return NextResponse.json({ error: e0.message }, { status: 500 });
    }
    const activos = ((proyectos ?? []) as ProyectoRow[]).filter(proyectoActivo);
    const detalles: Array<{ proyecto_id: string; total_ves: number; lineas: number }> = [];
    let actualizados = 0;

    for (const p of activos) {
      try {
        const res = await calculateLaborCost(supabase, p.id);
        const { error: upErr } = await supabase
          .from('ci_proyectos')
          .update({ obra_presupuesto_mano_obra_ves: res.totalCostoPersonal, updated_at: new Date().toISOString() })
          .eq('id', p.id);
        if (upErr) {
          detalles.push({ proyecto_id: p.id, total_ves: res.totalCostoPersonal, lineas: -1 });
          continue;
        }
        actualizados += 1;
        detalles.push({ proyecto_id: p.id, total_ves: res.totalCostoPersonal, lineas: res.lineas.length });
      } catch {
        detalles.push({ proyecto_id: p.id, total_ves: 0, lineas: -2 });
      }
    }

    return NextResponse.json({
      ok: true,
      revisados: activos.length,
      actualizados,
      detalles,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
