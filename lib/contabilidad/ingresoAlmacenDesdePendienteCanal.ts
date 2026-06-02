import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';
import { approveAllQualityInspectionsForInvoice } from '@/lib/almacen/approveQualityInspection';
import { crearCuarentenaDesdeFactura } from '@/lib/almacen/crearCuarentenaDesdeFactura';
import { finalizarLiberacionCuarentena } from '@/lib/almacen/finalizarLiberacionCuarentena';
import {
  mensajeLineasSinMaterialSku,
  resolverMaterialIdLineasCompra,
} from '@/lib/almacen/resolverMaterialIdPorSku';
import { registrarCompraInventario } from '@/lib/almacen/registrarCompraInventario';
import { sincronizarContabilidadTrasInventarioCompra } from '@/lib/contabilidad/sincronizarLogisticaCompraContable';

export type ResultadoIngresoAlmacenCanal = {
  success: boolean;
  compraFacturaId?: string;
  yaExistia?: boolean;
  viaCuarentena?: boolean;
  aprobadas?: number;
  error?: string;
};

export type OpcionesIngresoAlmacenCanal = {
  /** Evita releer purchase_invoice_id del pendiente (p. ej. justo tras confirmar). */
  purchaseInvoiceId?: string;
};

type LineaStock = { material_id: string; cantidad: number };

async function contarPendientesCuarentena(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('quality_inspections')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', purchaseInvoiceId)
    .eq('status', 'PENDIENTE');

  if (error && !/does not exist/i.test(error.message ?? '')) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function lineasComprasFactura(
  supabase: SupabaseClient,
  compraFacturaId: string,
): Promise<LineaStock[]> {
  const { data, error } = await supabase
    .from('compras_factura_lineas')
    .select('material_id, cantidad')
    .eq('factura_id', compraFacturaId);

  if (error && !/does not exist/i.test(error.message ?? '')) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((r) => ({
      material_id: String(r.material_id),
      cantidad: Number(r.cantidad) || 0,
    }))
    .filter((l) => l.material_id && l.cantidad > 0);
}

async function stockLineasEnUbicacion(
  supabase: SupabaseClient,
  ubicacionId: string,
  lineas: LineaStock[],
): Promise<boolean> {
  if (!ubicacionId.trim() || !lineas.length) return false;

  const materialIds = Array.from(new Set(lineas.map((l) => l.material_id)));
  const { data, error } = await supabase
    .from('inventario_stock')
    .select('material_id, cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .in('material_id', materialIds);

  if (error && !/does not exist/i.test(error.message ?? '')) {
    throw new Error(error.message);
  }

  const porMaterial = new Map(
    (data ?? []).map((r) => [String(r.material_id), Number(r.cantidad_disponible) || 0]),
  );

  return lineas.every((l) => (porMaterial.get(l.material_id) ?? 0) > 0);
}

async function reaplicarStockCompraFactura(
  supabase: SupabaseClient,
  compraFacturaId: string,
  ubicacionId: string,
  lineas: LineaStock[],
): Promise<void> {
  for (const l of lineas) {
    await aplicarDeltaStockInventario(supabase, {
      ubicacionId,
      materialId: l.material_id,
      deltaDisponible: l.cantidad,
      tipoMovimiento: 'ingreso_compra',
      documentoId: compraFacturaId,
      referenciaTipo: 'compras_facturas',
    });
  }
}

async function resolverUbicacionIngreso(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  ubicacionPendiente: string,
  ubicacionCompraContabilidad: string | null | undefined,
): Promise<string> {
  const destino =
    String(ubicacionCompraContabilidad ?? ubicacionPendiente ?? '').trim() ||
    '';

  if (destino) return destino;

  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('ubicacion_destino_id')
    .eq('id', purchaseInvoiceId)
    .maybeSingle();

  return String(inv?.ubicacion_destino_id ?? '').trim();
}

async function intentarCompletarCompraFacturaExistente(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  ubicacionFallback: string,
): Promise<ResultadoIngresoAlmacenCanal | null> {
  const { data: comprasFactura, error } = await supabase
    .from('compras_facturas')
    .select('id, estado, ubicacion_destino_id')
    .eq('purchase_invoice_id', purchaseInvoiceId)
    .maybeSingle();

  if (error && !/does not exist/i.test(error.message ?? '')) {
    throw new Error(error.message);
  }
  if (!comprasFactura?.id) return null;

  const compraFacturaId = String(comprasFactura.id);
  const ubicacionId = String(
    comprasFactura.ubicacion_destino_id ?? ubicacionFallback,
  ).trim();

  if (comprasFactura.estado === 'borrador') {
    const { error: regErr } = await supabase
      .from('compras_facturas')
      .update({ estado: 'registrada', updated_at: new Date().toISOString() })
      .eq('id', compraFacturaId);

    if (regErr) throw new Error(regErr.message);
  } else if (comprasFactura.estado !== 'registrada') {
    return null;
  }

  const lineas = await lineasComprasFactura(supabase, compraFacturaId);
  if (!ubicacionId) {
    return {
      success: false,
      error: 'La compra no tiene almacén de destino.',
    };
  }

  if (lineas.length > 0) {
    const yaHayStock = await stockLineasEnUbicacion(supabase, ubicacionId, lineas);
    if (!yaHayStock) {
      await reaplicarStockCompraFactura(supabase, compraFacturaId, ubicacionId, lineas);
    }
  }

  await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);

  return {
    success: true,
    yaExistia: true,
    compraFacturaId,
  };
}

/**
 * Ingreso a almacén desde factura Telegram: aprueba cuarentena pendiente o fallback legacy.
 */
export async function ingresoAlmacenDesdePendienteCanal(
  supabase: SupabaseClient,
  pendingId: string,
  opts?: OpcionesIngresoAlmacenCanal,
): Promise<ResultadoIngresoAlmacenCanal> {
  const { data: pendiente, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id,purchase_invoice_id,ubicacion_destino_id')
    .eq('id', pendingId)
    .maybeSingle();

  if (pErr) return { success: false, error: pErr.message };

  const purchaseInvoiceId = String(
    opts?.purchaseInvoiceId?.trim() || pendiente?.purchase_invoice_id || '',
  ).trim();

  if (!purchaseInvoiceId) {
    return { success: false, error: 'La compra aún no está confirmada en contabilidad.' };
  }

  const ubicacionPendiente = String(pendiente?.ubicacion_destino_id ?? '').trim();

  try {
    const { data: compra, error: cErr } = await supabase
      .from('contabilidad_compras')
      .select(
        'id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,ubicacion_destino_id',
      )
      .eq('purchase_invoice_id', purchaseInvoiceId)
      .maybeSingle();

    if (cErr) return { success: false, error: cErr.message };

    const destino = await resolverUbicacionIngreso(
      supabase,
      purchaseInvoiceId,
      ubicacionPendiente,
      compra?.ubicacion_destino_id,
    );

    const completado = await intentarCompletarCompraFacturaExistente(
      supabase,
      purchaseInvoiceId,
      destino,
    );
    if (completado?.success) return completado;

    if (!compra) {
      return {
        success: false,
        error: 'No se encontró la compra en contabilidad para este documento.',
      };
    }

    const resuelto = await resolverMaterialIdLineasCompra(supabase, String(compra.id));
    const lineasInventario = resuelto.lineas;

    if (!lineasInventario.length) {
      const detalle = mensajeLineasSinMaterialSku(resuelto.sinMatch);
      return {
        success: false,
        error: detalle
          ? `${detalle} Asigne item_code (SKU) en las líneas.`
          : 'La compra no tiene materiales vinculados para inventario.',
      };
    }

    if (!destino) {
      return { success: false, error: 'La compra no tiene almacén de destino.' };
    }

    let pendientes = await contarPendientesCuarentena(supabase, purchaseInvoiceId);

    if (pendientes === 0) {
      await crearCuarentenaDesdeFactura(supabase, {
        purchaseInvoiceId,
        lineas: lineasInventario.map((l) => ({
          material_id: l.material_id,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
        })),
      });
      pendientes = await contarPendientesCuarentena(supabase, purchaseInvoiceId);
    }

    if (pendientes > 0) {
      const { aprobadas } = await approveAllQualityInspectionsForInvoice(
        supabase,
        purchaseInvoiceId,
        null,
      );

      const { data: cf } = await supabase
        .from('compras_facturas')
        .select('id')
        .eq('purchase_invoice_id', purchaseInvoiceId)
        .maybeSingle();

      await finalizarLiberacionCuarentena(supabase, purchaseInvoiceId);
      await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);

      return {
        success: true,
        yaExistia: false,
        viaCuarentena: true,
        aprobadas,
        compraFacturaId: cf?.id ? String(cf.id) : undefined,
      };
    }

    const result = await registrarCompraInventario(supabase, {
      ubicacionDestinoId: destino,
      numeroFactura: String(compra.invoice_number ?? 'S/N'),
      proveedorRif: String(compra.supplier_rif ?? 'S/R'),
      proveedorNombre: String(compra.supplier_name ?? 'Proveedor'),
      fechaEmision: String(compra.fecha ?? new Date().toISOString().slice(0, 10)),
      total: Number(compra.total_amount ?? 0),
      purchaseInvoiceId,
      lineas: lineasInventario,
    });

    await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);

    return {
      success: true,
      yaExistia: false,
      viaCuarentena: false,
      compraFacturaId: result.compraFacturaId,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Error al registrar ingreso',
    };
  }
}
