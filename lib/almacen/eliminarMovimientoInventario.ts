import type { SupabaseClient } from '@supabase/supabase-js';

export type MovimientoInventarioRef =
  | { kind: 'ingreso_linea'; facturaId: string; lineaId: string }
  | { kind: 'ingreso_factura'; facturaId: string }
  | { kind: 'despacho_transferencia_linea'; transferenciaId: string; lineaId: string }
  | { kind: 'despacho_telegram'; movimientoId: string }
  | { kind: 'stock'; stockId: string };

const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

function parseDosUuids(rest: string): { a: string; b: string } | null {
  const m = rest.match(new RegExp(`^(${UUID})-(${UUID})$`, 'i'));
  if (!m) return null;
  return { a: m[1], b: m[2] };
}

export function parseMovimientoInventarioId(id: string): MovimientoInventarioRef | null {
  const s = id.trim();
  if (s.startsWith('ing-fac-')) {
    const facturaId = s.slice('ing-fac-'.length);
    return facturaId.match(new RegExp(`^${UUID}$`, 'i'))
      ? { kind: 'ingreso_factura', facturaId }
      : null;
  }
  if (s.startsWith('ing-')) {
    const par = parseDosUuids(s.slice('ing-'.length));
    if (!par) return null;
    return {
      kind: 'ingreso_linea',
      facturaId: par.a,
      lineaId: par.b,
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
  const { error } = await supabase.rpc('inv_stock_apply_delta', {
    p_ubicacion_id: ubicacionId,
    p_material_id: materialId,
    p_delta_disponible: delta,
    p_delta_reservada: 0,
    p_delta_transito_entrante: 0,
  });
  if (error?.code === '42883' || /inv_stock_apply_delta/i.test(error?.message ?? '')) {
    throw new Error('Función inv_stock_apply_delta no disponible. Aplique migración 180.');
  }
  if (error) throw new Error(error.message);
}

async function eliminarLineaIngreso(
  supabase: SupabaseClient,
  facturaId: string,
  lineaId: string,
): Promise<void> {
  const { data: linea, error: lErr } = await supabase
    .from('compras_factura_lineas')
    .select('id, material_id, cantidad, factura_id')
    .eq('id', lineaId)
    .eq('factura_id', facturaId)
    .maybeSingle();
  if (lErr) throw new Error(lErr.message);
  if (!linea) throw new Error('Línea de ingreso no encontrada.');

  const { data: fac } = await supabase
    .from('compras_facturas')
    .select('id, estado, ubicacion_destino_id')
    .eq('id', facturaId)
    .maybeSingle();
  if (!fac) throw new Error('Factura de compra no encontrada.');

  const materialId = String(linea.material_id ?? '').trim();
  const cantidad = Number(linea.cantidad ?? 0);
  const ubicacionId = String(fac.ubicacion_destino_id ?? '').trim();

  if (fac.estado === 'registrada' && materialId && ubicacionId && cantidad > 0) {
    await aplicarDeltaStock(supabase, ubicacionId, materialId, -cantidad);
  }

  const { error: delErr } = await supabase
    .from('compras_factura_lineas')
    .delete()
    .eq('id', lineaId);
  if (delErr) throw new Error(delErr.message);
}

async function eliminarFacturaIngreso(supabase: SupabaseClient, facturaId: string): Promise<void> {
  const { data: fac, error: fErr } = await supabase
    .from('compras_facturas')
    .select('id, estado, ubicacion_destino_id')
    .eq('id', facturaId)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);
  if (!fac) throw new Error('Factura de compra no encontrada.');

  if (fac.estado === 'registrada') {
    const ubicacionId = String(fac.ubicacion_destino_id ?? '').trim();
    const { data: lineas } = await supabase
      .from('compras_factura_lineas')
      .select('material_id, cantidad')
      .eq('factura_id', facturaId);
    for (const ln of lineas ?? []) {
      const materialId = String(ln.material_id ?? '').trim();
      const cantidad = Number(ln.cantidad ?? 0);
      if (materialId && ubicacionId && cantidad > 0) {
        await aplicarDeltaStock(supabase, ubicacionId, materialId, -cantidad);
      }
    }
  }

  const { error: delErr } = await supabase.from('compras_facturas').delete().eq('id', facturaId);
  if (delErr) throw new Error(delErr.message);
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

async function eliminarStockUbicacion(supabase: SupabaseClient, stockId: string): Promise<void> {
  const { data: row, error: sErr } = await supabase
    .from('inventario_stock')
    .select('id, ubicacion_id, material_id, cantidad_disponible')
    .eq('id', stockId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!row) throw new Error('Registro de stock no encontrado.');

  const ubicacionId = String(row.ubicacion_id ?? '').trim();
  const materialId = String(row.material_id ?? '').trim();
  const cantidad = Number(row.cantidad_disponible ?? 0);

  if (ubicacionId && materialId && cantidad > 0) {
    await aplicarDeltaStock(supabase, ubicacionId, materialId, -cantidad);
  }

  const { error: delErr } = await supabase.from('inventario_stock').delete().eq('id', stockId);
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
      await eliminarStockUbicacion(supabase, ref.stockId);
      return { ok: true, mensaje: 'Stock en ubicación eliminado.' };
    default:
      throw new Error('Tipo de movimiento no soportado.');
  }
}

export function movimientoInventarioEsEliminable(id: string): boolean {
  return parseMovimientoInventarioId(id) != null;
}
