import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';
import { asegurarUbicacionObra } from '@/lib/almacen/ubicacionesInventario';

export type ReubicarCompraInput = {
  /** contabilidad_compras.id o purchase_invoices.id */
  referenciaId: string;
  referenciaTipo?: 'compra' | 'purchase_invoice';
  entidadId?: string | null;
  proyectoId: string;
  /** Vacío = contabilidad sin almacén asignado (ingreso físico pendiente). */
  ubicacionDestinoId?: string | null;
  nombreObra?: string;
};

export type ReubicarCompraResult = {
  purchaseInvoiceId: string | null;
  compraId: string | null;
  stockMovido: boolean;
  ubicacionAnteriorId: string | null;
  sinCambios?: boolean;
  message?: string;
};

async function moverStockCompraRegistrada(
  supabase: SupabaseClient,
  params: {
    compraFacturaId: string;
    ubicacionAnteriorId: string;
    ubicacionNuevaId: string;
  },
): Promise<void> {
  const { data: lineas, error: lErr } = await supabase
    .from('compras_factura_lineas')
    .select('material_id, cantidad')
    .eq('factura_id', params.compraFacturaId);

  if (lErr) throw new Error(lErr.message);
  if (!lineas?.length) return;

  for (const linea of lineas) {
    const materialId = String(linea.material_id);
    const qty = Number(linea.cantidad);
    if (qty <= 0) continue;

    await aplicarDeltaStockInventario(supabase, {
      ubicacionId: params.ubicacionAnteriorId,
      materialId,
      deltaDisponible: -qty,
      tipoMovimiento: 'transferencia_salida',
    });

    await aplicarDeltaStockInventario(supabase, {
      ubicacionId: params.ubicacionNuevaId,
      materialId,
      deltaDisponible: qty,
      tipoMovimiento: 'transferencia_entrada',
    });
  }
}

/**
 * Reasigna obra y almacén de una compra (purchase_invoices, contabilidad, canal, inventario).
 */
export async function reubicarCompraObra(
  supabase: SupabaseClient,
  input: ReubicarCompraInput,
): Promise<ReubicarCompraResult> {
  const proyectoId = input.proyectoId.trim();
  const ubicacionNuevaId = String(input.ubicacionDestinoId ?? '').trim() || null;
  const entidadId = input.entidadId?.trim() || null;
  if (!proyectoId) throw new Error('Seleccione la obra.');

  if (ubicacionNuevaId) {
    const { data: ubi, error: uErr } = await supabase
      .from('inv_ubicaciones')
      .select('id, nombre, tipo, ci_proyecto_id, activo')
      .eq('id', ubicacionNuevaId)
      .maybeSingle();

    if (uErr?.code === '42P01') {
      throw new Error('Tabla inv_ubicaciones no existe. Aplique migración 180.');
    }
    if (uErr) throw new Error(uErr.message);
    if (!ubi) throw new Error('Ubicación de almacén no encontrada.');
    if (ubi.activo === false) throw new Error('La ubicación seleccionada está inactiva.');

    const esDeObra =
      ubi.tipo === 'obra' ||
      ubi.tipo === 'almacen_movil' ||
      (ubi.ci_proyecto_id != null && ubi.ci_proyecto_id === proyectoId);
    const esCentral = ubi.tipo === 'almacen_central' || ubi.tipo === 'cuarentena';

    if (!esCentral && !esDeObra) {
      throw new Error('La ubicación no corresponde a la obra seleccionada.');
    }
  }

  let purchaseInvoiceId: string | null = null;
  let compraId: string | null = null;
  let proyectoActual: string | null = null;
  let ubicacionActual: string | null = null;

  if (input.referenciaTipo === 'purchase_invoice') {
    purchaseInvoiceId = input.referenciaId;
  } else {
    const { data: compra, error: cErr } = await supabase
      .from('contabilidad_compras')
      .select('id, purchase_invoice_id, proyecto_id, ubicacion_destino_id')
      .eq('id', input.referenciaId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!compra) throw new Error('Compra no encontrada en contabilidad.');
    compraId = String(compra.id);
    purchaseInvoiceId = compra.purchase_invoice_id ? String(compra.purchase_invoice_id) : null;
    proyectoActual = compra.proyecto_id ? String(compra.proyecto_id) : null;
    ubicacionActual = compra.ubicacion_destino_id ? String(compra.ubicacion_destino_id) : null;
  }

  if (!purchaseInvoiceId) {
    const { data: inv, error: iErr } = await supabase
      .from('purchase_invoices')
      .select('id, proyecto_id, ubicacion_destino_id')
      .eq('id', input.referenciaId)
      .maybeSingle();
    if (!iErr && inv?.id) {
      purchaseInvoiceId = String(inv.id);
      proyectoActual = inv.proyecto_id ? String(inv.proyecto_id) : proyectoActual;
      ubicacionActual = inv.ubicacion_destino_id ? String(inv.ubicacion_destino_id) : ubicacionActual;
    }
  }

  if (purchaseInvoiceId && (!proyectoActual || !ubicacionActual)) {
    const { data: invRow } = await supabase
      .from('purchase_invoices')
      .select('proyecto_id, ubicacion_destino_id')
      .eq('id', purchaseInvoiceId)
      .maybeSingle();
    if (invRow) {
      proyectoActual = invRow.proyecto_id ? String(invRow.proyecto_id) : proyectoActual;
      ubicacionActual = invRow.ubicacion_destino_id ? String(invRow.ubicacion_destino_id) : ubicacionActual;
    }
  }

  if (
    proyectoActual === proyectoId &&
    ubicacionActual === ubicacionNuevaId
  ) {
    return {
      purchaseInvoiceId,
      compraId,
      stockMovido: false,
      ubicacionAnteriorId: ubicacionActual,
      sinCambios: true,
      message: 'La compra ya se encuentra en la ubicación seleccionada.',
    };
  }

  let ubicacionAnteriorId: string | null = ubicacionActual;

  if (purchaseInvoiceId) {
    const { data: invRow, error: invErr } = await supabase
      .from('purchase_invoices')
      .select('id, ubicacion_destino_id')
      .eq('id', purchaseInvoiceId)
      .single();
    if (invErr) throw new Error(invErr.message);
    ubicacionAnteriorId = invRow.ubicacion_destino_id
      ? String(invRow.ubicacion_destino_id)
      : null;

    const patchInv: Record<string, unknown> = {
      proyecto_id: proyectoId,
      ubicacion_destino_id: ubicacionNuevaId,
    };
    if (entidadId) patchInv.entidad_id = entidadId;
    const { error: upInv } = await supabase
      .from('purchase_invoices')
      .update(patchInv)
      .eq('id', purchaseInvoiceId);
    if (upInv) throw new Error(upInv.message);
  }

  if (compraId) {
    const patchCompra: Record<string, unknown> = {
      proyecto_id: proyectoId,
      updated_at: new Date().toISOString(),
    };
    if (entidadId) patchCompra.entidad_id = entidadId;
    const { error: upCompra } = await supabase
      .from('contabilidad_compras')
      .update({ ...patchCompra, ubicacion_destino_id: ubicacionNuevaId } as never)
      .eq('id', compraId);
    if (upCompra && !/ubicacion_destino_id|column/i.test(upCompra.message)) {
      throw new Error(upCompra.message);
    }
    if (upCompra && /ubicacion_destino_id/i.test(upCompra.message)) {
      const { error: upSinUbi } = await supabase
        .from('contabilidad_compras')
        .update(patchCompra)
        .eq('id', compraId);
      if (upSinUbi) throw new Error(upSinUbi.message);
    }
  } else if (purchaseInvoiceId) {
    const { data: compraByInv } = await supabase
      .from('contabilidad_compras')
      .select('id')
      .eq('purchase_invoice_id', purchaseInvoiceId)
      .maybeSingle();
    if (compraByInv?.id) {
      compraId = String(compraByInv.id);
      const patchByInv: Record<string, unknown> = {
        proyecto_id: proyectoId,
        ubicacion_destino_id: ubicacionNuevaId,
      };
      if (entidadId) patchByInv.entidad_id = entidadId;
      await supabase
        .from('contabilidad_compras')
        .update(patchByInv as never)
        .eq('id', compraId);
    }
  }

  if (purchaseInvoiceId) {
    const { data: pendientes } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('id, extracted')
      .eq('purchase_invoice_id', purchaseInvoiceId);

    for (const pend of pendientes ?? []) {
      const prev = (pend.extracted as Record<string, unknown> | null) ?? {};
      const patchCanal: Record<string, unknown> = {
        proyecto_id: proyectoId,
        ubicacion_destino_id: ubicacionNuevaId,
        extracted: {
          ...prev,
          reubicacion: {
            reubicado_automaticamente: true,
            fecha_reubicacion: new Date().toISOString(),
            entidad_id: entidadId,
            proyecto_id: proyectoId,
            ubicacion_destino_id: ubicacionNuevaId,
          },
        },
        updated_at: new Date().toISOString(),
      };
      if (entidadId) patchCanal.entidad_id = entidadId;
      await supabase
        .from('ci_facturas_canal_pendientes')
        .update(patchCanal)
        .eq('id', pend.id);
    }
  }

  let stockMovido = false;

  if (purchaseInvoiceId) {
    const { data: cf, error: cfErr } = await supabase
      .from('compras_facturas')
      .select('id, estado, ubicacion_destino_id')
      .eq('purchase_invoice_id', purchaseInvoiceId)
      .maybeSingle();

    if (cfErr?.code !== '42P01' && cfErr) throw new Error(cfErr.message);

    if (cf?.id) {
      const cfId = String(cf.id);
      const estado = String(cf.estado ?? '');
      const ubiAnt =
        ubicacionAnteriorId ?? (cf.ubicacion_destino_id ? String(cf.ubicacion_destino_id) : null);

      if (
        estado === 'registrada' &&
        ubiAnt &&
        ubicacionNuevaId &&
        ubiAnt !== ubicacionNuevaId
      ) {
        await moverStockCompraRegistrada(supabase, {
          compraFacturaId: cfId,
          ubicacionAnteriorId: ubiAnt,
          ubicacionNuevaId,
        });
        stockMovido = true;
      }

      const { error: upCf } = await supabase
        .from('compras_facturas')
        .update({ ubicacion_destino_id: ubicacionNuevaId })
        .eq('id', cfId);
      if (upCf) throw new Error(upCf.message);
    }
  }

  if (input.nombreObra) {
    await asegurarUbicacionObra(supabase, proyectoId, input.nombreObra).catch(() => {
      /* opcional */
    });
  }

  return {
    purchaseInvoiceId,
    compraId,
    stockMovido,
    ubicacionAnteriorId,
    message: stockMovido
      ? 'Compra reubicada con éxito. Inventarios físicos y libros contables bimonetarios sincronizados en caliente.'
      : ubicacionNuevaId
        ? 'Obra y almacén de ingreso actualizados.'
        : 'Obra actualizada en contabilidad. El almacén se asignará al ingresar el material.',
  };
}
