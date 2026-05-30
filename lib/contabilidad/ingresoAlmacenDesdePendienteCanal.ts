import type { SupabaseClient } from '@supabase/supabase-js';
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

/**
 * Ingreso a almacén desde factura Telegram: aprueba cuarentena pendiente o fallback legacy.
 */
export async function ingresoAlmacenDesdePendienteCanal(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<ResultadoIngresoAlmacenCanal> {
  const { data: pendiente, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id,purchase_invoice_id,ubicacion_destino_id')
    .eq('id', pendingId)
    .maybeSingle();

  if (pErr) return { success: false, error: pErr.message };
  if (!pendiente?.purchase_invoice_id) {
    return { success: false, error: 'La compra aún no está confirmada en contabilidad.' };
  }

  const purchaseInvoiceId = String(pendiente.purchase_invoice_id);
  const ubicacionDestinoId = String(pendiente.ubicacion_destino_id ?? '').trim();

  const { data: existente } = await supabase
    .from('compras_facturas')
    .select('id')
    .eq('purchase_invoice_id', purchaseInvoiceId)
    .maybeSingle();

  if (existente?.id) {
    await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);
    return {
      success: true,
      yaExistia: true,
      compraFacturaId: String(existente.id),
    };
  }

  const { data: compra, error: cErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,ubicacion_destino_id',
    )
    .eq('purchase_invoice_id', purchaseInvoiceId)
    .maybeSingle();

  if (cErr || !compra) {
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

  const destino = String(compra.ubicacion_destino_id ?? ubicacionDestinoId).trim();
  if (!destino) {
    return { success: false, error: 'La compra no tiene almacén de destino.' };
  }

  try {
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
