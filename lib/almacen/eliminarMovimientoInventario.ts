import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';

export type MovimientoInventarioRef =
  | { kind: 'ingreso_linea'; facturaId: string; lineaId: string }
  | { kind: 'ingreso_detalle'; purchaseInvoiceId: string; detailId: string }
  | { kind: 'ingreso_factura'; facturaId: string }
  | { kind: 'despacho_transferencia_linea'; transferenciaId: string; lineaId: string }
  | { kind: 'despacho_telegram'; movimientoId: string }
  | { kind: 'stock'; stockId?: string; ubicacionId?: string; materialId?: string };

const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp(UUID, 'gi');

function parseDosUuids(rest: string): { a: string; b: string } | null {
  const m = rest.match(new RegExp(`^(${UUID})-(${UUID})$`, 'i'));
  if (!m) return null;
  return { a: m[1], b: m[2] };
}

/** Formato nuevo: ing-{facturaId}_{lineaId} (sin ambigüedad entre UUIDs). */
function parseIngresoLineaRest(rest: string): { facturaId: string; lineaId: string } | null {
  const sep = rest.indexOf('_');
  if (sep <= 0) return null;
  const facturaId = rest.slice(0, sep).trim();
  const lineaId = rest.slice(sep + 1).trim();
  if (!facturaId.match(new RegExp(`^${UUID}$`, 'i'))) return null;
  if (!lineaId.match(new RegExp(`^${UUID}$`, 'i'))) return null;
  return { facturaId, lineaId };
}

function parseIngresoLineaId(rest: string): { facturaId: string; lineaId: string } | null {
  const conGuionBajo = parseIngresoLineaRest(rest);
  if (conGuionBajo) return conGuionBajo;

  const dosUuid = parseDosUuids(rest);
  if (dosUuid) return { facturaId: dosUuid.a, lineaId: dosUuid.b };

  const uuids = rest.match(UUID_RE);
  if (uuids && uuids.length >= 2) {
    return {
      facturaId: uuids[0],
      lineaId: uuids[uuids.length - 1],
    };
  }
  return null;
}

export function parseMovimientoInventarioId(id: string): MovimientoInventarioRef | null {
  const s = id.trim();
  if (s.startsWith('ing-fac-')) {
    const facturaId = s.slice('ing-fac-'.length);
    return facturaId.match(new RegExp(`^${UUID}$`, 'i'))
      ? { kind: 'ingreso_factura', facturaId }
      : null;
  }
  if (s.startsWith('ing-pd-')) {
    const par = parseIngresoLineaRest(s.slice('ing-pd-'.length));
    if (!par) return null;
    return {
      kind: 'ingreso_detalle',
      purchaseInvoiceId: par.facturaId,
      detailId: par.lineaId,
    };
  }
  if (s.startsWith('ing-')) {
    const par = parseIngresoLineaId(s.slice('ing-'.length));
    if (!par) return null;
    return {
      kind: 'ingreso_linea',
      facturaId: par.facturaId,
      lineaId: par.lineaId,
    };
  }
  if (s.startsWith('desp-tr-')) {
    const par = parseDosUuids(s.slice('desp-tr-'.length));
    if (!par) return null;
    return {
      kind: 'despacho_transferencia_linea',
      transferenciaId: par.a,
      lineaId: par.b,
    };
  }
  if (s.startsWith('desp-tg-')) {
    const movimientoId = s.slice('desp-tg-'.length);
    return movimientoId.match(new RegExp(`^${UUID}$`, 'i'))
      ? { kind: 'despacho_telegram', movimientoId }
      : null;
  }
  if (s.startsWith('stk-pair-')) {
    const rest = s.slice('stk-pair-'.length);
    const m = rest.match(new RegExp(`^(${UUID})_(${UUID})$`, 'i'));
    if (!m) return null;
    return {
      kind: 'stock',
      ubicacionId: m[1],
      materialId: m[2],
    };
  }
  if (s.startsWith('stk-')) {
    const stockId = s.slice('stk-'.length);
    return stockId.match(new RegExp(`^${UUID}$`, 'i')) ? { kind: 'stock', stockId } : null;
  }
  return null;
}

async function aplicarDeltaStock(
  supabase: SupabaseClient,
  ubicacionId: string,
  materialId: string,
  delta: number,
): Promise<void> {
  await aplicarDeltaStockInventario(supabase, {
    ubicacionId,
    materialId,
    deltaDisponible: delta,
    tipoMovimiento: 'anulacion',
    notas: 'Reversión por eliminación de movimiento',
  });
}

type LineaIngresoRow = {
  id: string;
  material_id: string | null;
  cantidad: number | null;
  factura_id: string;
};

type LineaIngresoResuelta = {
  linea: LineaIngresoRow;
  facturaId: string;
  origen: 'compras_factura_lineas' | 'purchase_details';
  purchaseDetailId?: string;
  purchaseInvoiceId?: string;
};

async function resolverCompraFacturaId(
  supabase: SupabaseClient,
  hint: string,
): Promise<string | null> {
  const id = hint.trim();
  if (!id) return null;

  const { data: directa } = await supabase
    .from('compras_facturas')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (directa?.id) return String(directa.id);

  const { data: porInv } = await supabase
    .from('compras_facturas')
    .select('id')
    .eq('purchase_invoice_id', id)
    .maybeSingle();
  return porInv?.id ? String(porInv.id) : null;
}

type ContextoFacturaIngreso = {
  tipo: 'compras' | 'cuarentena';
  id: string;
  estado: string;
  ubicacion_destino_id: string | null;
};

async function resolverContextoFacturaIngreso(
  supabase: SupabaseClient,
  hint: string,
): Promise<ContextoFacturaIngreso | null> {
  const id = hint.trim();
  if (!id) return null;

  const compraId = (await resolverCompraFacturaId(supabase, id)) ?? id;

  const { data: compra } = await supabase
    .from('compras_facturas')
    .select('id, estado, ubicacion_destino_id')
    .eq('id', compraId)
    .maybeSingle();
  if (compra?.id) {
    return {
      tipo: 'compras',
      id: String(compra.id),
      estado: String(compra.estado ?? ''),
      ubicacion_destino_id: compra.ubicacion_destino_id ?? null,
    };
  }

  const { data: compraPorPi } = await supabase
    .from('compras_facturas')
    .select('id, estado, ubicacion_destino_id')
    .eq('purchase_invoice_id', id)
    .maybeSingle();
  if (compraPorPi?.id) {
    return {
      tipo: 'compras',
      id: String(compraPorPi.id),
      estado: String(compraPorPi.estado ?? ''),
      ubicacion_destino_id: compraPorPi.ubicacion_destino_id ?? null,
    };
  }

  const invoiceIds = [id];
  if (compraId !== id) invoiceIds.push(compraId);
  for (const invoiceId of invoiceIds) {
    const { data: inv } = await supabase
      .from('purchase_invoices')
      .select('id, ubicacion_destino_id')
      .eq('id', invoiceId)
      .maybeSingle();
    if (inv?.id) {
      return {
        tipo: 'cuarentena',
        id: String(inv.id),
        estado: 'registrada',
        ubicacion_destino_id: inv.ubicacion_destino_id ?? null,
      };
    }
  }

  return null;
}

async function resolverLineaIngreso(
  supabase: SupabaseClient,
  facturaIdHint: string,
  lineaId: string,
): Promise<LineaIngresoResuelta | null> {
  const lineaIdTrim = lineaId.trim();
  const hint = facturaIdHint.trim();
  if (!lineaIdTrim) return null;

  const { data: porId, error: e1 } = await supabase
    .from('compras_factura_lineas')
    .select('id, material_id, cantidad, factura_id')
    .eq('id', lineaIdTrim)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (porId?.id) {
    const row = porId as LineaIngresoRow;
    return { linea: row, facturaId: row.factura_id, origen: 'compras_factura_lineas' };
  }

  const { data: detalle, error: pdErr } = await supabase
    .from('purchase_details')
    .select('id, material_id, quantity, invoice_id')
    .eq('id', lineaIdTrim)
    .maybeSingle();
  if (pdErr && !/does not exist/i.test(pdErr.message ?? '')) throw new Error(pdErr.message);
  if (detalle?.id) {
    const materialId = String(detalle.material_id ?? '').trim();
    const qty = Number(detalle.quantity ?? 0);
    const purchaseInvoiceId = String(detalle.invoice_id ?? '').trim();
    const facturaId =
      (hint ? await resolverCompraFacturaId(supabase, hint) : null) ??
      (purchaseInvoiceId ? await resolverCompraFacturaId(supabase, purchaseInvoiceId) : null) ??
      hint;
    return {
      linea: {
        id: String(detalle.id),
        material_id: materialId || null,
        cantidad: qty,
        factura_id: facturaId,
      },
      facturaId,
      origen: 'purchase_details',
      purchaseDetailId: String(detalle.id),
      purchaseInvoiceId: purchaseInvoiceId || undefined,
    };
  }

  if (hint) {
    const facturaId = (await resolverCompraFacturaId(supabase, hint)) ?? hint;
    const { data: porFactura } = await supabase
      .from('compras_factura_lineas')
      .select('id, material_id, cantidad, factura_id')
      .eq('factura_id', facturaId)
      .eq('material_id', lineaIdTrim)
      .maybeSingle();
    if (porFactura?.id) {
      return {
        linea: porFactura as LineaIngresoRow,
        facturaId,
        origen: 'compras_factura_lineas',
      };
    }
  }

  return null;
}

async function revertirStockEnUbicacion(
  supabase: SupabaseClient,
  ubicacionId: string,
  materialId: string,
): Promise<boolean> {
  if (!ubicacionId || !materialId) return false;

  const { data: stock } = await supabase
    .from('inventario_stock')
    .select('id, cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .eq('material_id', materialId)
    .maybeSingle();

  const qty = Number(stock?.cantidad_disponible ?? 0);
  if (qty <= 0) return false;

  await aplicarDeltaStock(supabase, ubicacionId, materialId, -qty);
  if (stock?.id) {
    await supabase.from('inventario_stock').delete().eq('id', stock.id);
  }
  return true;
}

async function eliminarDetalleCuarentena(
  supabase: SupabaseClient,
  purchaseDetailId: string,
): Promise<void> {
  await supabase
    .from('quality_inspections')
    .delete()
    .eq('purchase_detail_id', purchaseDetailId);
  const { error } = await supabase.from('purchase_details').delete().eq('id', purchaseDetailId);
  if (error) throw new Error(error.message);
}

async function revertirIngresoHuérfano(
  supabase: SupabaseClient,
  facturaIdHint: string,
  lineaOrMaterialId: string,
): Promise<boolean> {
  const ctx = await resolverContextoFacturaIngreso(supabase, facturaIdHint);
  if (!ctx || ctx.estado !== 'registrada') return false;

  const ubicacionId = String(ctx.ubicacion_destino_id ?? '').trim();
  if (!ubicacionId) return false;

  const materialHint = lineaOrMaterialId.trim();
  if (materialHint && (await revertirStockEnUbicacion(supabase, ubicacionId, materialHint))) {
    return true;
  }

  const { data: stockRows } = await supabase
    .from('inventario_stock')
    .select('material_id, cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .gt('cantidad_disponible', 0);

  const activos = (stockRows ?? []).filter((r) => Number(r.cantidad_disponible) > 0);
  if (activos.length === 1) {
    const materialId = String(activos[0].material_id ?? '').trim();
    return revertirStockEnUbicacion(supabase, ubicacionId, materialId);
  }

  return false;
}

async function eliminarLineaIngreso(
  supabase: SupabaseClient,
  facturaId: string,
  lineaId: string,
): Promise<void> {
  const resuelto = await resolverLineaIngreso(supabase, facturaId, lineaId);
  if (!resuelto) {
    const revertido = await revertirIngresoHuérfano(supabase, facturaId, lineaId);
    if (revertido) return;

    const { count } = await supabase
      .from('compras_factura_lineas')
      .select('id', { count: 'exact', head: true })
      .eq('id', lineaId);
    if ((count ?? 0) === 0) return;

    throw new Error(
      'Línea de ingreso no encontrada. Actualice la lista: el movimiento pudo haberse eliminado ya o el ID es antiguo.',
    );
  }

  const { linea } = resuelto;

  if (resuelto.origen === 'purchase_details' && resuelto.purchaseDetailId) {
    await eliminarDetalleIngreso(
      supabase,
      resuelto.purchaseInvoiceId ?? facturaId,
      resuelto.purchaseDetailId,
    );
    return;
  }

  const facturaIdReal = resuelto.facturaId;
  const ctx = await resolverContextoFacturaIngreso(supabase, facturaIdReal);

  const materialId = String(linea.material_id ?? '').trim();
  const cantidad = Number(linea.cantidad ?? 0);

  if (!ctx) {
    if (materialId && cantidad > 0) {
      const revertido = await revertirIngresoHuérfano(supabase, facturaIdReal, materialId);
      if (revertido) {
        if (resuelto.origen === 'compras_factura_lineas') {
          await supabase.from('compras_factura_lineas').delete().eq('id', linea.id);
        }
        return;
      }
    }
    if (resuelto.origen === 'compras_factura_lineas') {
      const { error: delErr } = await supabase
        .from('compras_factura_lineas')
        .delete()
        .eq('id', linea.id);
      if (delErr) throw new Error(delErr.message);
      return;
    }
    throw new Error('Factura de compra no encontrada.');
  }

  const ubicacionId = String(ctx.ubicacion_destino_id ?? '').trim();

  if (ctx.estado === 'registrada' && materialId && ubicacionId && cantidad > 0) {
    await aplicarDeltaStock(supabase, ubicacionId, materialId, -cantidad);
  }

  if (resuelto.origen === 'compras_factura_lineas') {
    const { error: delErr } = await supabase
      .from('compras_factura_lineas')
      .delete()
      .eq('id', linea.id);
    if (delErr) throw new Error(delErr.message);
    return;
  }

  if (resuelto.purchaseDetailId) {
    await eliminarDetalleCuarentena(supabase, resuelto.purchaseDetailId);
  }
}

async function eliminarDetalleIngreso(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  detailId: string,
): Promise<void> {
  const { data: detalle, error: dErr } = await supabase
    .from('purchase_details')
    .select('id, material_id, quantity, invoice_id')
    .eq('id', detailId)
    .maybeSingle();
  if (dErr) throw new Error(dErr.message);
  if (!detalle?.id) {
    const revertido = await revertirIngresoHuérfano(supabase, purchaseInvoiceId, detailId);
    if (revertido) return;
    return;
  }

  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, ubicacion_destino_id')
    .eq('id', String(detalle.invoice_id ?? purchaseInvoiceId))
    .maybeSingle();

  const materialId = String(detalle.material_id ?? '').trim();
  const cantidad = Number(detalle.quantity ?? 0);
  const ubicacionId = String(inv?.ubicacion_destino_id ?? '').trim();

  if (materialId && ubicacionId && cantidad > 0) {
    await aplicarDeltaStock(supabase, ubicacionId, materialId, -cantidad);
  }

  await eliminarDetalleCuarentena(supabase, String(detalle.id));
}

async function revertirStockHuérfanoFactura(
  supabase: SupabaseClient,
  facturaId: string,
  ubicacionId: string,
): Promise<void> {
  const { data: stockRows } = await supabase
    .from('inventario_stock')
    .select('material_id, cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .gt('cantidad_disponible', 0);

  for (const row of stockRows ?? []) {
    const materialId = String(row.material_id ?? '').trim();
    const qty = Number(row.cantidad_disponible ?? 0);
    if (materialId && qty > 0) {
      await aplicarDeltaStock(supabase, ubicacionId, materialId, -qty);
    }
  }
}

async function eliminarFacturaCuarentena(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
): Promise<void> {
  const ctx = await resolverContextoFacturaIngreso(supabase, purchaseInvoiceId);
  if (!ctx || ctx.tipo !== 'cuarentena') return;

  const ubicacionId = String(ctx.ubicacion_destino_id ?? '').trim();
  const { data: detalles } = await supabase
    .from('purchase_details')
    .select('id, material_id, quantity')
    .eq('invoice_id', ctx.id);

  for (const det of detalles ?? []) {
    const materialId = String(det.material_id ?? '').trim();
    const cantidad = Number(det.quantity ?? 0);
    if (materialId && ubicacionId && cantidad > 0) {
      await aplicarDeltaStock(supabase, ubicacionId, materialId, -cantidad);
    }
    await eliminarDetalleCuarentena(supabase, String(det.id));
  }

  if (!detalles?.length && ubicacionId) {
    await revertirStockHuérfanoFactura(supabase, ctx.id, ubicacionId);
  }
}

async function eliminarFacturaIngreso(supabase: SupabaseClient, facturaId: string): Promise<void> {
  const hint = facturaId.trim().replace(/^ing-fac-/i, '');
  if (!hint) throw new Error('ID de factura inválido.');

  const ctx = await resolverContextoFacturaIngreso(supabase, hint);

  if (ctx?.tipo === 'cuarentena') {
    await eliminarFacturaCuarentena(supabase, ctx.id);
    return;
  }

  const facturaReal =
    ctx?.tipo === 'compras' ? ctx.id : (await resolverCompraFacturaId(supabase, hint)) ?? hint;

  const { data: fac, error: fErr } = await supabase
    .from('compras_facturas')
    .select('id, estado, ubicacion_destino_id')
    .eq('id', facturaReal)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);

  if (!fac?.id) {
    const { count: quedan } = await supabase
      .from('compras_facturas')
      .select('id', { count: 'exact', head: true })
      .eq('id', facturaReal);
    if ((quedan ?? 0) === 0) return;
    throw new Error('Factura de compra no encontrada.');
  }

  const ubicacionId = String(fac.ubicacion_destino_id ?? '').trim();
  const estado = String(fac.estado ?? ctx?.estado ?? '');

  if (estado === 'registrada') {
    const { data: lineas } = await supabase
      .from('compras_factura_lineas')
      .select('material_id, cantidad')
      .eq('factura_id', facturaReal);
    for (const ln of lineas ?? []) {
      const materialId = String(ln.material_id ?? '').trim();
      const cantidad = Number(ln.cantidad ?? 0);
      if (materialId && ubicacionId && cantidad > 0) {
        await aplicarDeltaStock(supabase, ubicacionId, materialId, -cantidad);
      }
    }
    if (!(lineas ?? []).length && ubicacionId) {
      await revertirStockHuérfanoFactura(supabase, facturaReal, ubicacionId);
    }
  }

  const { error: delErr } = await supabase.from('compras_facturas').delete().eq('id', facturaReal);
  if (delErr) throw new Error(delErr.message);

  const { count: restante } = await supabase
    .from('compras_facturas')
    .select('id', { count: 'exact', head: true })
    .eq('id', facturaReal);
  if ((restante ?? 0) > 0) {
    throw new Error('No se pudo eliminar la factura de compra. Revise permisos o enlaces en contabilidad.');
  }
}

async function eliminarLineaTransferencia(
  supabase: SupabaseClient,
  transferenciaId: string,
  lineaId: string,
): Promise<void> {
  const { data: tr, error: tErr } = await supabase
    .from('transferencias_inventario')
    .select('id, estado, origen_ubicacion_id, destino_ubicacion_id')
    .eq('id', transferenciaId)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!tr) throw new Error('Transferencia no encontrada.');

  const { data: linea, error: lErr } = await supabase
    .from('transferencias_inventario_lineas')
    .select('id, material_id, cantidad')
    .eq('id', lineaId)
    .eq('transferencia_id', transferenciaId)
    .maybeSingle();
  if (lErr) throw new Error(lErr.message);
  if (!linea) throw new Error('Línea de despacho no encontrada.');

  const materialId = String(linea.material_id ?? '').trim();
  const cantidad = Number(linea.cantidad ?? 0);
  const origenId = String(tr.origen_ubicacion_id ?? '').trim();
  const destinoId = String(tr.destino_ubicacion_id ?? '').trim();
  const estado = String(tr.estado ?? '');

  if (materialId && cantidad > 0) {
    if (estado === 'en_transito' && origenId) {
      await aplicarDeltaStock(supabase, origenId, materialId, cantidad);
    } else if (estado === 'completado' && origenId && destinoId) {
      await aplicarDeltaStock(supabase, destinoId, materialId, -cantidad);
      await aplicarDeltaStock(supabase, origenId, materialId, cantidad);
    }
  }

  const { error: delErr } = await supabase
    .from('transferencias_inventario_lineas')
    .delete()
    .eq('id', lineaId);
  if (delErr) throw new Error(delErr.message);

  const { count } = await supabase
    .from('transferencias_inventario_lineas')
    .select('id', { count: 'exact', head: true })
    .eq('transferencia_id', transferenciaId);
  if ((count ?? 0) === 0 && estado === 'pendiente') {
    await supabase.from('transferencias_inventario').delete().eq('id', transferenciaId);
  }
}

async function eliminarDespachoTelegram(supabase: SupabaseClient, movimientoId: string): Promise<void> {
  const { error } = await supabase
    .from('ci_obra_movimientos_material')
    .delete()
    .eq('id', movimientoId);
  if (error?.code === '42P01') {
    throw new Error('Tabla ci_obra_movimientos_material no disponible.');
  }
  if (error) throw new Error(error.message);
}

type StockRow = {
  id: string;
  ubicacion_id: string;
  material_id: string;
  cantidad_disponible: number;
};

async function buscarFilaInventarioStock(
  supabase: SupabaseClient,
  ref: { stockId?: string; ubicacionId?: string; materialId?: string },
): Promise<StockRow | null> {
  const stockId = ref.stockId?.trim();
  if (stockId) {
    const { data, error } = await supabase
      .from('inventario_stock')
      .select('id, ubicacion_id, material_id, cantidad_disponible')
      .eq('id', stockId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return data as StockRow;
  }

  const ubicacionId = ref.ubicacionId?.trim();
  const materialId = ref.materialId?.trim();
  if (ubicacionId && materialId) {
    const { data, error } = await supabase
      .from('inventario_stock')
      .select('id, ubicacion_id, material_id, cantidad_disponible')
      .eq('ubicacion_id', ubicacionId)
      .eq('material_id', materialId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return data as StockRow;
  }

  return null;
}

async function eliminarStockUbicacion(
  supabase: SupabaseClient,
  ref: { stockId?: string; ubicacionId?: string; materialId?: string },
): Promise<void> {
  const row = await buscarFilaInventarioStock(supabase, ref);
  if (!row) {
    throw new Error(
      'Registro de stock no encontrado. Actualice la lista: el saldo pudo haber cambiado o ya fue eliminado.',
    );
  }

  const ubicacionId = String(row.ubicacion_id ?? '').trim();
  const materialId = String(row.material_id ?? '').trim();
  const cantidad = Number(row.cantidad_disponible ?? 0);

  if (ubicacionId && materialId && cantidad > 0) {
    await aplicarDeltaStock(supabase, ubicacionId, materialId, -cantidad);
  }

  const { error: delErr } = await supabase.from('inventario_stock').delete().eq('id', row.id);
  if (delErr) throw new Error(delErr.message);
}

export async function eliminarMovimientoInventario(
  supabase: SupabaseClient,
  movimientoId: string,
): Promise<{ ok: true; mensaje: string }> {
  const ref = parseMovimientoInventarioId(movimientoId);
  if (!ref) {
    throw new Error('Identificador de movimiento no válido.');
  }

  switch (ref.kind) {
    case 'ingreso_linea':
      await eliminarLineaIngreso(supabase, ref.facturaId, ref.lineaId);
      return { ok: true, mensaje: 'Línea de ingreso eliminada y stock ajustado.' };
    case 'ingreso_detalle':
      await eliminarDetalleIngreso(supabase, ref.purchaseInvoiceId, ref.detailId);
      return { ok: true, mensaje: 'Detalle de ingreso eliminado y stock ajustado.' };
    case 'ingreso_factura':
      await eliminarFacturaIngreso(supabase, ref.facturaId);
      return { ok: true, mensaje: 'Factura de ingreso eliminada y stock revertido.' };
    case 'despacho_transferencia_linea':
      await eliminarLineaTransferencia(supabase, ref.transferenciaId, ref.lineaId);
      return { ok: true, mensaje: 'Línea de despacho eliminada y stock ajustado.' };
    case 'despacho_telegram':
      await eliminarDespachoTelegram(supabase, ref.movimientoId);
      return { ok: true, mensaje: 'Registro de despacho Telegram eliminado.' };
    case 'stock':
      await eliminarStockUbicacion(supabase, {
        stockId: ref.stockId,
        ubicacionId: ref.ubicacionId,
        materialId: ref.materialId,
      });
      return { ok: true, mensaje: 'Stock en ubicación eliminado.' };
    default:
      throw new Error('Tipo de movimiento no soportado.');
  }
}

export function movimientoInventarioEsEliminable(id: string): boolean {
  return parseMovimientoInventarioId(id) != null;
}
