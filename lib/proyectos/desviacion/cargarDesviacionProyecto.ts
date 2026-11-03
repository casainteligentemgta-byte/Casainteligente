import type { SupabaseClient } from '@supabase/supabase-js';
import { obtenerTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';
import { costoEgresoLineaUsd } from '@/lib/proyectos/desviacion/montoAUsd';
import {
  calcularDesviacionPresupuestaria,
  esCapituloManoObra,
  materialesComprasUsd,
  presupuestoPorCapitulo,
  resolverPresupuestoUsd,
  UMBRAL_DESVIACION_DEFAULT_PCT,
  type CompraDesviacion,
  type PartidaPresupuesto,
} from '@/lib/proyectos/desviacion/calcularDesviacionPresupuestaria';
import { esMigracionJornalesPendiente } from '@/lib/proyectos/jornales/calcularJornalesSemana';
import { hoyIsoCaracas } from '@/lib/proyectos/jornales/semanaJornales';
import type { DesviacionPresupuestariaPayload } from '@/types/desviacion';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function cargarDesviacionProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<DesviacionPresupuestariaPayload> {
  const { data: proy, error: pErr } = await supabase
    .from('ci_proyectos')
    .select(
      'id,nombre,monto_aproximado,moneda,obra_precio_venta_usd,obra_presupuesto_ves,obra_presupuesto_mano_obra_ves',
    )
    .eq('id', proyectoId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!proy) throw new Error('Proyecto no encontrado');

  const tasaRes = await obtenerTasaBcvVesPorUsd(hoyIsoCaracas(), { supabase }).catch(() => ({
    tasa_bcv_ves_por_usd: 36.5,
  }));
  const tasa = tasaRes.tasa_bcv_ves_por_usd > 0 ? tasaRes.tasa_bcv_ves_por_usd : 36.5;

  const [partidasRes, comprasRes, laborRes, egresosRes, configRes] = await Promise.all([
    supabase
      .from('ci_presupuesto_partidas')
      .select('codigo_partida,descripcion,capitulo_codigo,capitulo_descripcion,monto_total_estimado')
      .eq('proyecto_id', proyectoId),
    supabase
      .from('contabilidad_compras')
      .select('monto_usd,monto_ves,total_amount,moneda,moneda_original,tasa_bcv_ves_por_usd')
      .eq('proyecto_id', proyectoId),
    supabase
      .from('ci_jornales_obra_asistencias')
      .select('empleado_id,costo_jornal,fecha')
      .eq('proyecto_id', proyectoId)
      .eq('estado', 'presente'),
    supabase.from('inv_egresos_campo').select('id').eq('proyecto_id', proyectoId),
    supabase.from('ci_proyecto_desviacion_config').select('*').eq('proyecto_id', proyectoId).maybeSingle(),
  ]);

  const migErr = laborRes.error ?? configRes.error;
  if (migErr && esMigracionJornalesPendiente(migErr.message)) {
    throw new Error('Aplique la migración 382_ci_jornales_obra_y_desviacion.sql en Supabase.');
  }

  const partidas: PartidaPresupuesto[] = (partidasRes.data ?? []).map((p) => ({
    codigo: (p as { codigo_partida?: string }).codigo_partida,
    descripcion: (p as { descripcion?: string }).descripcion,
    capitulo_codigo: (p as { capitulo_codigo?: string | null }).capitulo_codigo,
    capitulo_descripcion: (p as { capitulo_descripcion?: string | null }).capitulo_descripcion,
    monto_total_estimado: num((p as { monto_total_estimado?: unknown }).monto_total_estimado),
  }));

  const { presupuestoUsd, fuente } = resolverPresupuestoUsd({
    partidas,
    montoAproximado: num((proy as { monto_aproximado?: unknown }).monto_aproximado),
    moneda: (proy as { moneda?: string | null }).moneda,
    obraPrecioVentaUsd: num((proy as { obra_precio_venta_usd?: unknown }).obra_precio_venta_usd),
    obraPresupuestoVes: num((proy as { obra_presupuesto_ves?: unknown }).obra_presupuesto_ves),
    tasaBcv: tasa,
  });

  const compras: CompraDesviacion[] = (comprasRes.error ? [] : comprasRes.data ?? []) as CompraDesviacion[];
  const materialesUsd = materialesComprasUsd(compras, tasa);

  const laborUsd = (laborRes.data ?? []).reduce(
    (s, r) => s + num((r as { costo_jornal?: unknown }).costo_jornal),
    0,
  );

  let egresosUsd = 0;
  const egresoIds = (egresosRes.data ?? []).map((r) => String((r as { id: string }).id));
  if (egresoIds.length) {
    const { data: lineas } = await supabase
      .from('inv_egresos_campo_lineas')
      .select('cantidad, material_id, ci_presupuesto_partida_id')
      .in('egreso_id', egresoIds);
    const matIds = Array.from(
      new Set((lineas ?? []).map((l) => String((l as { material_id?: string }).material_id ?? '')).filter(Boolean)),
    );
    const costoPorMat = new Map<string, { avg: number; last: number }>();
    if (matIds.length) {
      const { data: mats } = await supabase
        .from('global_inventory')
        .select('id, average_weighted_cost, last_purchase_price')
        .in('id', matIds);
      for (const m of mats ?? []) {
        costoPorMat.set(String((m as { id: string }).id), {
          avg: num((m as { average_weighted_cost?: unknown }).average_weighted_cost),
          last: num((m as { last_purchase_price?: unknown }).last_purchase_price),
        });
      }
    }
    for (const ln of lineas ?? []) {
      const mid = String((ln as { material_id?: string }).material_id ?? '');
      const c = costoPorMat.get(mid);
      egresosUsd += costoEgresoLineaUsd({
        cantidad: num((ln as { cantidad?: unknown }).cantidad),
        averageWeightedCost: c?.avg,
        lastPurchasePrice: c?.last,
      });
    }
  }

  const capitulos = presupuestoPorCapitulo(partidas);
  const presupuestoMoPartidas = capitulos
    .filter((c) => esCapituloManoObra(c.descripcion, c.codigo))
    .reduce((s, c) => s + c.presupuesto_usd, 0);
  const presupuestoMoVes = num((proy as { obra_presupuesto_mano_obra_ves?: unknown }).obra_presupuesto_mano_obra_ves);
  const presupuestoManoObraUsd =
    presupuestoMoPartidas > 0
      ? presupuestoMoPartidas
      : presupuestoMoVes > 0 && tasa > 0
        ? presupuestoMoVes / tasa
        : 0;
  const presupuestoMaterialesUsd = Math.max(0, presupuestoUsd - presupuestoManoObraUsd);

  const ejecutadoPorCapitulo = capitulos.map((c) => {
    if (esCapituloManoObra(c.descripcion, c.codigo)) {
      const peso =
        presupuestoMoPartidas > 0 ? c.presupuesto_usd / presupuestoMoPartidas : 1 / Math.max(1, capitulos.filter((x) => esCapituloManoObra(x.descripcion, x.codigo)).length);
      return { codigo: c.codigo, ejecutadoUsd: laborUsd * peso };
    }
    const pesoMat =
      presupuestoMaterialesUsd > 0
        ? c.presupuesto_usd / presupuestoMaterialesUsd
        : 1 / Math.max(1, capitulos.filter((x) => !esCapituloManoObra(x.descripcion, x.codigo)).length);
    return { codigo: c.codigo, ejecutadoUsd: (materialesUsd + egresosUsd) * pesoMat };
  });

  const cfg = configRes.data as {
    umbral_desviacion_pct?: number;
    umbral_materiales_pct?: number;
    umbral_mano_obra_pct?: number;
    limite_jornadas_instalacion?: number | null;
    especialidad_limite?: string | null;
  } | null;

  const especialidadLimite = cfg?.especialidad_limite?.trim() || 'Instalador CCTV';
  const laborEmpIds = Array.from(
    new Set((laborRes.data ?? []).map((r) => String((r as { empleado_id?: string }).empleado_id ?? '')).filter(Boolean)),
  );
  let jornadasEspecialidad = 0;
  if (laborEmpIds.length) {
    const { data: emps } = await supabase
      .from('ci_empleados')
      .select('id, cargo_nombre')
      .in('id', laborEmpIds);
    const idsCctv = new Set(
      (emps ?? [])
        .filter((e) => {
          const cargo = String((e as { cargo_nombre?: string | null }).cargo_nombre ?? '');
          return cargo.toLowerCase().includes(especialidadLimite.toLowerCase());
        })
        .map((e) => String((e as { id: string }).id)),
    );
    jornadasEspecialidad = (laborRes.data ?? []).filter((r) =>
      idsCctv.has(String((r as { empleado_id?: string }).empleado_id ?? '')),
    ).length;
  }

  return calcularDesviacionPresupuestaria({
    proyectoId,
    proyectoNombre: String((proy as { nombre?: string }).nombre ?? 'Proyecto'),
    presupuestoUsd,
    fuentePresupuesto: fuente,
    laborUsd,
    materialesUsd,
    egresosUsd,
    presupuestoManoObraUsd,
    presupuestoMaterialesUsd,
    umbralPct: cfg?.umbral_desviacion_pct ?? UMBRAL_DESVIACION_DEFAULT_PCT,
    umbralMaterialesPct: cfg?.umbral_materiales_pct ?? UMBRAL_DESVIACION_DEFAULT_PCT,
    umbralManoObraPct: cfg?.umbral_mano_obra_pct ?? UMBRAL_DESVIACION_DEFAULT_PCT,
    limiteJornadasInstalacion: cfg?.limite_jornadas_instalacion ?? null,
    especialidadLimite,
    capitulos,
    ejecutadoPorCapitulo,
    jornadasPorEspecialidad: [
      { especialidad: especialidadLimite, jornadas: jornadasEspecialidad, limite: cfg?.limite_jornadas_instalacion ?? null },
    ],
    tasaBcv: tasa,
  });
}
