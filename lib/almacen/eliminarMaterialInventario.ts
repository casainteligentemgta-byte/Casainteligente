import type { SupabaseClient } from '@supabase/supabase-js';

export type ResumenVinculosMaterial = {
  movimientos: number;
  stock: number;
  comprasLineas: number;
  comprasFacturas: number;
  transferenciasLineas: number;
  transferencias: number;
  egresosLineas: number;
  egresos: number;
  recepcionesLineas: number;
  recepciones: number;
  series: number;
  obraPartidas: number;
  maquinariaHoras: number;
  maquinaria: number;
  purchaseDetails: number;
  inventoryMovements: number;
  qualityInspections: number;
  contabilidadLineas: number;
};

function emptyResumen(): ResumenVinculosMaterial {
  return {
    movimientos: 0,
    stock: 0,
    comprasLineas: 0,
    comprasFacturas: 0,
    transferenciasLineas: 0,
    transferencias: 0,
    egresosLineas: 0,
    egresos: 0,
    recepcionesLineas: 0,
    recepciones: 0,
    series: 0,
    obraPartidas: 0,
    maquinariaHoras: 0,
    maquinaria: 0,
    purchaseDetails: 0,
    inventoryMovements: 0,
    qualityInspections: 0,
    contabilidadLineas: 0,
  };
}

export function totalVinculosMaterial(r: ResumenVinculosMaterial): number {
  return (
    r.movimientos +
    r.stock +
    r.comprasLineas +
    r.comprasFacturas +
    r.transferenciasLineas +
    r.transferencias +
    r.egresosLineas +
    r.egresos +
    r.recepcionesLineas +
    r.recepciones +
    r.series +
    r.obraPartidas +
    r.maquinariaHoras +
    r.maquinaria +
    r.purchaseDetails +
    r.inventoryMovements +
    r.qualityInspections +
    r.contabilidadLineas
  );
}

async function countEq(
  supabase: SupabaseClient,
  table: string,
  materialId: string,
  column = 'material_id',
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, materialId);
  if (error && !/does not exist/i.test(error.message ?? '')) throw new Error(error.message);
  return count ?? 0;
}

/** Cuenta registros vinculados antes de confirmar borrado en cascada. */
export async function contarVinculosMaterialInventario(
  supabase: SupabaseClient,
  materialId: string,
): Promise<ResumenVinculosMaterial> {
  const resumen = emptyResumen();

  const { data: material } = await supabase
    .from('global_inventory')
    .select('id')
    .eq('id', materialId)
    .maybeSingle();
  if (!material?.id) {
    throw new Error('Material no encontrado.');
  }

  resumen.movimientos = await countEq(supabase, 'inv_movimientos', materialId);
  resumen.stock = await countEq(supabase, 'inventario_stock', materialId);
  resumen.comprasLineas = await countEq(supabase, 'compras_factura_lineas', materialId);
  resumen.transferenciasLineas = await countEq(
    supabase,
    'transferencias_inventario_lineas',
    materialId,
  );
  resumen.egresosLineas = await countEq(supabase, 'inv_egresos_campo_lineas', materialId);
  resumen.recepcionesLineas = await countEq(supabase, 'ci_recepciones_campo_lineas', materialId);
  resumen.series = await countEq(supabase, 'series_productos', materialId);
  resumen.obraPartidas = await countEq(supabase, 'obra_partidas_materiales', materialId);
  resumen.purchaseDetails = await countEq(supabase, 'purchase_details', materialId);
  resumen.qualityInspections = await countEq(supabase, 'quality_inspections', materialId);
  resumen.contabilidadLineas = await countEq(supabase, 'contabilidad_compra_lineas', materialId);
  resumen.inventoryMovements = await countEq(supabase, 'inventory_movements', materialId);

  const { data: maq } = await supabase
    .from('ci_maquinaria_maestro')
    .select('id')
    .eq('global_inventory_id', materialId);
  resumen.maquinaria = maq?.length ?? 0;
  if (maq?.length) {
    const ids = maq.map((m) => m.id);
    const { count } = await supabase
      .from('ci_maquinaria_control_horas')
      .select('id', { count: 'exact', head: true })
      .in('maquinaria_id', ids);
    resumen.maquinariaHoras = count ?? 0;
  }

  if (resumen.comprasLineas > 0) {
    const { data: lineas } = await supabase
      .from('compras_factura_lineas')
      .select('factura_id')
      .eq('material_id', materialId);
    const facturaIds = Array.from(new Set((lineas ?? []).map((l) => l.factura_id)));
    if (facturaIds.length) {
      const { data: todas } = await supabase
        .from('compras_factura_lineas')
        .select('factura_id')
        .in('factura_id', facturaIds);
      const totalPorFactura = new Map<string, number>();
      for (const row of todas ?? []) {
        const fid = String(row.factura_id);
        totalPorFactura.set(fid, (totalPorFactura.get(fid) ?? 0) + 1);
      }
      const lineasPorFactura = new Map<string, number>();
      for (const row of lineas ?? []) {
        const fid = String(row.factura_id);
        lineasPorFactura.set(fid, (lineasPorFactura.get(fid) ?? 0) + 1);
      }
      for (const [fid, nLineasMaterial] of Array.from(lineasPorFactura.entries())) {
        if ((totalPorFactura.get(fid) ?? 0) === nLineasMaterial) {
          resumen.comprasFacturas += 1;
        }
      }
    }
  }

  return resumen;
}

async function eliminarCabecerasSinLineas(
  supabase: SupabaseClient,
  opts: {
    lineasTable: string;
    cabeceraTable: string;
    fkColumn: string;
    cabeceraIds: string[];
  },
): Promise<number> {
  if (!opts.cabeceraIds.length) return 0;
  const uniqueIds = Array.from(new Set(opts.cabeceraIds));
  let eliminadas = 0;

  for (const cabeceraId of uniqueIds) {
    const { count } = await supabase
      .from(opts.lineasTable)
      .select('id', { count: 'exact', head: true })
      .eq(opts.fkColumn, cabeceraId);
    if ((count ?? 0) > 0) continue;

    const { data, error } = await supabase
      .from(opts.cabeceraTable)
      .delete()
      .eq('id', cabeceraId)
      .select('id');
    if (error) throw new Error(error.message);
    if (data?.length) eliminadas += 1;
  }

  return eliminadas;
}

async function deleteByMaterial(
  supabase: SupabaseClient,
  table: string,
  materialId: string,
  column = 'material_id',
): Promise<number> {
  const { data, error } = await supabase.from(table).delete().eq(column, materialId).select('id');
  if (error && !/does not exist/i.test(error.message ?? '')) throw new Error(error.message);
  return data?.length ?? 0;
}

/**
 * Elimina un material de global_inventory y todos los registros restrictivos vinculados.
 * Usar solo con cliente service_role (API servidor).
 */
export async function eliminarMaterialInventarioCascada(
  supabase: SupabaseClient,
  materialId: string,
): Promise<{ resumen: ResumenVinculosMaterial }> {
  const resumen = emptyResumen();

  const { data: material } = await supabase
    .from('global_inventory')
    .select('id, name')
    .eq('id', materialId)
    .maybeSingle();
  if (!material?.id) {
    throw new Error('Material no encontrado.');
  }

  // Egresos campo: líneas → cabeceras huérfanas
  const { data: egresoLineas } = await supabase
    .from('inv_egresos_campo_lineas')
    .select('id, egreso_id')
    .eq('material_id', materialId);
  resumen.egresosLineas = egresoLineas?.length ?? 0;
  if (egresoLineas?.length) {
    const { error } = await supabase
      .from('inv_egresos_campo_lineas')
      .delete()
      .eq('material_id', materialId);
    if (error) throw new Error(error.message);
    resumen.egresos = await eliminarCabecerasSinLineas(supabase, {
      lineasTable: 'inv_egresos_campo_lineas',
      cabeceraTable: 'inv_egresos_campo',
      fkColumn: 'egreso_id',
      cabeceraIds: egresoLineas.map((l) => String(l.egreso_id)),
    });
  }

  // Transferencias: líneas → cabeceras huérfanas
  const { data: trLineas } = await supabase
    .from('transferencias_inventario_lineas')
    .select('id, transferencia_id')
    .eq('material_id', materialId);
  resumen.transferenciasLineas = trLineas?.length ?? 0;
  if (trLineas?.length) {
    const { error } = await supabase
      .from('transferencias_inventario_lineas')
      .delete()
      .eq('material_id', materialId);
    if (error) throw new Error(error.message);
    resumen.transferencias = await eliminarCabecerasSinLineas(supabase, {
      lineasTable: 'transferencias_inventario_lineas',
      cabeceraTable: 'transferencias_inventario',
      fkColumn: 'transferencia_id',
      cabeceraIds: trLineas.map((l) => String(l.transferencia_id)),
    });
  }

  resumen.series = await deleteByMaterial(supabase, 'series_productos', materialId);

  // Compras inventario: líneas → facturas huérfanas
  const { data: compraLineas } = await supabase
    .from('compras_factura_lineas')
    .select('id, factura_id')
    .eq('material_id', materialId);
  resumen.comprasLineas = compraLineas?.length ?? 0;
  if (compraLineas?.length) {
    const { error } = await supabase
      .from('compras_factura_lineas')
      .delete()
      .eq('material_id', materialId);
    if (error) throw new Error(error.message);
    resumen.comprasFacturas = await eliminarCabecerasSinLineas(supabase, {
      lineasTable: 'compras_factura_lineas',
      cabeceraTable: 'compras_facturas',
      fkColumn: 'factura_id',
      cabeceraIds: compraLineas.map((l) => String(l.factura_id)),
    });
  }

  // Recepciones campo: líneas → cabeceras huérfanas
  const { data: recepLineas } = await supabase
    .from('ci_recepciones_campo_lineas')
    .select('id, recepcion_id')
    .eq('material_id', materialId);
  resumen.recepcionesLineas = recepLineas?.length ?? 0;
  if (recepLineas?.length) {
    const { error } = await supabase
      .from('ci_recepciones_campo_lineas')
      .delete()
      .eq('material_id', materialId);
    if (error) throw new Error(error.message);
    resumen.recepciones = await eliminarCabecerasSinLineas(supabase, {
      lineasTable: 'ci_recepciones_campo_lineas',
      cabeceraTable: 'ci_recepciones_campo',
      fkColumn: 'recepcion_id',
      cabeceraIds: recepLineas.map((l) => String(l.recepcion_id)),
    });
  }

  // Maquinaria intercompany
  const { data: maqRows } = await supabase
    .from('ci_maquinaria_maestro')
    .select('id')
    .eq('global_inventory_id', materialId);
  if (maqRows?.length) {
    const maqIds = maqRows.map((m) => m.id);
    resumen.maquinaria = maqIds.length;
    const { data: horasDel } = await supabase
      .from('ci_maquinaria_control_horas')
      .delete()
      .in('maquinaria_id', maqIds)
      .select('id');
    resumen.maquinariaHoras = horasDel?.length ?? 0;
    const { error: maqErr } = await supabase
      .from('ci_maquinaria_maestro')
      .delete()
      .eq('global_inventory_id', materialId);
    if (maqErr) throw new Error(maqErr.message);
  }

  resumen.movimientos = await deleteByMaterial(supabase, 'inv_movimientos', materialId);
  resumen.obraPartidas = await deleteByMaterial(supabase, 'obra_partidas_materiales', materialId);
  resumen.stock = await deleteByMaterial(supabase, 'inventario_stock', materialId);
  resumen.purchaseDetails = await deleteByMaterial(supabase, 'purchase_details', materialId);
  resumen.qualityInspections = await deleteByMaterial(supabase, 'quality_inspections', materialId);
  resumen.contabilidadLineas = await deleteByMaterial(
    supabase,
    'contabilidad_compra_lineas',
    materialId,
  );
  resumen.inventoryMovements = await deleteByMaterial(
    supabase,
    'inventory_movements',
    materialId,
  );

  const { data: deleted, error: delMatErr } = await supabase
    .from('global_inventory')
    .delete()
    .eq('id', materialId)
    .select('id');
  if (delMatErr) throw new Error(delMatErr.message);
  if (!deleted?.length) {
    throw new Error('No se pudo eliminar el material (restricciones pendientes).');
  }

  return { resumen };
}

export function formatResumenVinculosMaterial(r: ResumenVinculosMaterial): string {
  const partes: string[] = [];
  if (r.movimientos) partes.push(`${r.movimientos} movimiento(s) de stock`);
  if (r.comprasLineas) {
    partes.push(
      `${r.comprasLineas} línea(s) de compra${r.comprasFacturas ? ` (${r.comprasFacturas} factura(s) completas)` : ''}`,
    );
  }
  if (r.transferenciasLineas) {
    partes.push(
      `${r.transferenciasLineas} línea(s) de transferencia${r.transferencias ? ` (${r.transferencias} transferencia(s) completas)` : ''}`,
    );
  }
  if (r.egresosLineas) {
    partes.push(
      `${r.egresosLineas} línea(s) de egreso${r.egresos ? ` (${r.egresos} egreso(s) completos)` : ''}`,
    );
  }
  if (r.recepcionesLineas) {
    partes.push(
      `${r.recepcionesLineas} línea(s) de recepción en campo${r.recepciones ? ` (${r.recepciones} recepción(es) completas)` : ''}`,
    );
  }
  if (r.stock) partes.push(`${r.stock} registro(s) de stock`);
  if (r.series) partes.push(`${r.series} número(s) de serie`);
  if (r.obraPartidas) partes.push(`${r.obraPartidas} techo(s) presupuestario(s)`);
  if (r.maquinaria) {
    partes.push(
      `${r.maquinaria} ficha(s) de maquinaria${r.maquinariaHoras ? ` (${r.maquinariaHoras} hora(s) registradas)` : ''}`,
    );
  }
  if (r.purchaseDetails) partes.push(`${r.purchaseDetails} línea(s) de cuarentena`);
  if (r.qualityInspections) partes.push(`${r.qualityInspections} inspección(es) de calidad`);
  if (r.contabilidadLineas) partes.push(`${r.contabilidadLineas} línea(s) contables`);
  if (r.inventoryMovements) partes.push(`${r.inventoryMovements} movimiento(s) legacy`);
  return partes.length ? partes.join('\n• ') : 'sin registros vinculados';
}
