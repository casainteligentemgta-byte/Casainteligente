import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarLiberacionTransitoADisponible } from '@/lib/almacen/stockTransitoCompra';
import { approveAllQualityInspectionsForInvoice } from '@/lib/almacen/approveQualityInspection';
import { crearCuarentenaDesdeFactura } from '@/lib/almacen/crearCuarentenaDesdeFactura';
import { finalizarLiberacionCuarentena } from '@/lib/almacen/finalizarLiberacionCuarentena';
import type { LineaCompraContabilidadInput } from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import {
  parseCondicionPagoExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
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
  /** Avisos no bloqueantes (p. ej. líneas sin SKU que se crearon en catálogo). */
  avisos?: string[];
  materialesCreados?: number;
  sinMatch?: string[];
};

function lineasDesdeExtractedCanal(ex: ExtractedCanalHeader | null): LineaCompraContabilidadInput[] {
  if (!ex?.items?.length) return [];
  return ex.items
    .filter((it) => String(it.description ?? '').trim())
    .map((it) => {
      const cantidad = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      const precio = Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0;
      return {
        descripcion: String(it.description ?? '').trim(),
        item_code: String(it.item_code ?? '').trim() || null,
        unidad: String(it.unit ?? 'UND').trim() || 'UND',
        cantidad,
        precio_unitario: precio,
      };
    });
}

export type OpcionesIngresoAlmacenCanal = {
  /** Evita releer purchase_invoice_id del pendiente (p. ej. justo tras confirmar). */
  purchaseInvoiceId?: string;
  /** Cantidades físicas verificadas en Telegram (/ingresofactura). */
  cantidadesRecibidas?: Array<{ material_id: string; cantidad: number }>;
  /** Primera foto de soporte (recepción). */
  documentoStoragePath?: string | null;
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
    await aplicarLiberacionTransitoADisponible(supabase, {
      ubicacionDestinoId: ubicacionId,
      materialId: l.material_id,
      cantidad: l.cantidad,
      purchaseInvoiceId: compraFacturaId,
      referenciaTipo: 'compras_facturas',
    });
  }
}

/**
 * D-01: detecta ingreso físico previo (p. ej. `/ingreso` → ci_registrar_ingreso_manual_campo).
 * En ese caso compras_facturas queda en borrador a propósito; no debe pasar a registrada
 * (dispararía inv_compra_registrar_stock y duplicaría disponible).
 */
async function compraConIngresoFisicoPrevio(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  ubicacionId: string,
  lineas: LineaStock[],
): Promise<boolean> {
  const invId = purchaseInvoiceId.trim();
  if (!invId) return false;

  const { data: compra, error } = await supabase
    .from('contabilidad_compras')
    .select('ingresado_almacen_at')
    .eq('purchase_invoice_id', invId)
    .maybeSingle();

  if (error && !/ingresado_almacen_at|42703|does not exist/i.test(error.message ?? '')) {
    throw new Error(error.message);
  }

  if ((compra as { ingresado_almacen_at?: string | null } | null)?.ingresado_almacen_at) {
    return true;
  }

  if (ubicacionId.trim() && lineas.length > 0) {
    return stockLineasEnUbicacion(supabase, ubicacionId, lineas);
  }

  return false;
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

  const lineas = await lineasComprasFactura(supabase, compraFacturaId);
  if (!ubicacionId) {
    return {
      success: false,
      error: 'La compra no tiene almacén de destino.',
    };
  }

  if (comprasFactura.estado === 'borrador') {
    const ingresoFisicoPrevio = await compraConIngresoFisicoPrevio(
      supabase,
      purchaseInvoiceId,
      ubicacionId,
      lineas,
    );

    if (ingresoFisicoPrevio) {
      await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);
      return {
        success: true,
        yaExistia: true,
        compraFacturaId,
        avisos: [
          'El stock ya fue ingresado en campo; se sincronizó contabilidad sin duplicar inventario.',
        ],
      };
    }

    const { error: regErr } = await supabase
      .from('compras_facturas')
      .update({ estado: 'registrada', updated_at: new Date().toISOString() })
      .eq('id', compraFacturaId);

    if (regErr) throw new Error(regErr.message);
  } else if (comprasFactura.estado !== 'registrada') {
    return null;
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
  const { data: pendienteCanal, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id,purchase_invoice_id,ubicacion_destino_id,proyecto_id,extracted')
    .eq('id', pendingId)
    .maybeSingle();

  if (pErr) return { success: false, error: pErr.message };

  type PendienteIngreso = {
    id: string;
    purchase_invoice_id: string | null;
    ubicacion_destino_id: string | null;
    proyecto_id: string | null;
    extracted: unknown;
  };

  let pendiente: PendienteIngreso | null = (pendienteCanal as PendienteIngreso | null) ?? null;

  if (!pendiente) {
    const { data: compraDirecta, error: cdErr } = await supabase
      .from('contabilidad_compras')
      .select('id, purchase_invoice_id, ubicacion_destino_id, proyecto_id')
      .eq('id', pendingId)
      .maybeSingle();

    if (cdErr) return { success: false, error: cdErr.message };

    if (compraDirecta?.purchase_invoice_id) {
      pendiente = {
        id: String(compraDirecta.id),
        purchase_invoice_id: String(compraDirecta.purchase_invoice_id),
        ubicacion_destino_id: compraDirecta.ubicacion_destino_id ?? null,
        proyecto_id: compraDirecta.proyecto_id ?? null,
        extracted: null,
      };
    }
  }

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

    const lineasExtracted = lineasDesdeExtractedCanal(
      (pendiente?.extracted ?? null) as ExtractedCanalHeader | null,
    );

    const resuelto = await resolverMaterialIdLineasCompra(supabase, String(compra.id), {
      proyectoIdFallback: String(pendiente?.proyecto_id ?? '').trim() || null,
      ubicacionDestinoId: destino || ubicacionPendiente || null,
      purchaseInvoiceId,
      lineasExtracted,
    });
    const overrideCant = new Map(
      (opts?.cantidadesRecibidas ?? [])
        .filter((c) => c.material_id?.trim() && Number(c.cantidad) > 0)
        .map((c) => [c.material_id.trim(), Number(c.cantidad)]),
    );
    const lineasInventario = resuelto.lineas.map((l) => {
      const id = String(l.material_id ?? '').trim();
      const override = id ? overrideCant.get(id) : undefined;
      if (override == null || !Number.isFinite(override)) return l;
      return { ...l, cantidad: override };
    });

    const avisos: string[] = [];
    if (resuelto.materialesCreados > 0) {
      avisos.push(
        `Se crearon ${resuelto.materialesCreados} material(es) nuevo(s) en el catálogo de la obra.`,
      );
    }
    const detalleSinMatch = mensajeLineasSinMaterialSku(resuelto.sinMatch);
    if (detalleSinMatch) {
      avisos.push(detalleSinMatch);
    }

    if (!lineasInventario.length) {
      return {
        success: false,
        error: detalleSinMatch
          ? `${detalleSinMatch} Revise las líneas en la app.`
          : lineasExtracted.length
            ? 'No se pudieron vincular los productos de la factura. Confirme la compra con proyecto y almacén.'
            : 'La compra no tiene líneas de detalle. Agregue productos en la app y reintente.',
        sinMatch: resuelto.sinMatch,
      };
    }

    if (!destino) {
      return { success: false, error: 'La compra no tiene almacén de destino.' };
    }

    let pendientes = await contarPendientesCuarentena(supabase, purchaseInvoiceId);

    if (pendientes === 0) {
      await crearCuarentenaDesdeFactura(supabase, {
        purchaseInvoiceId,
        ubicacionDestinoId: destino,
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
        avisos: avisos.length ? avisos : undefined,
        materialesCreados: resuelto.materialesCreados || undefined,
        sinMatch: resuelto.sinMatch.length ? resuelto.sinMatch : undefined,
      };
    }

    const extractedHeader = (pendiente?.extracted ?? null) as ExtractedCanalHeader | null;
    const condicionPago = parseCondicionPagoExtracted(extractedHeader?.condicion_pago);

    const result = await registrarCompraInventario(supabase, {
      ubicacionDestinoId: destino,
      numeroFactura: String(compra.invoice_number ?? 'S/N'),
      proveedorRif: String(compra.supplier_rif ?? 'S/R'),
      proveedorNombre: String(compra.supplier_name ?? 'Proveedor'),
      fechaEmision: String(compra.fecha ?? new Date().toISOString().slice(0, 10)),
      total: Number(compra.total_amount ?? 0),
      purchaseInvoiceId,
      documentoStoragePath: opts?.documentoStoragePath?.trim() || null,
      condicion_pago: condicionPago,
      dias_credito: extractedHeader?.dias_credito ?? null,
      lineas: lineasInventario,
    });

    await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);

    return {
      success: true,
      yaExistia: false,
      viaCuarentena: false,
      compraFacturaId: result.compraFacturaId,
      avisos: avisos.length ? avisos : undefined,
      materialesCreados: resuelto.materialesCreados || undefined,
      sinMatch: resuelto.sinMatch.length ? resuelto.sinMatch : undefined,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Error al registrar ingreso',
    };
  }
}
