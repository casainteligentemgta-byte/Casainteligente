import type { SupabaseClient } from '@supabase/supabase-js';
import type { LineaCompraInventarioInput } from '@/lib/almacen/registrarCompraInventario';

export type ResultadoIngresoAlmacenAtomico = {
  success: boolean;
  yaExistia: boolean;
  compraFacturaId?: string;
  ingresoFisicoPrevio?: boolean;
  concurrencia?: boolean;
  aviso?: string;
  procuraId?: string;
  procuraTicket?: string;
  desviacionUsd?: number;
  error?: string;
  rpcNoDisponible?: boolean;
};

type RpcIngresoRow = {
  success?: boolean;
  ya_existia?: boolean;
  compra_factura_id?: string;
  ingreso_fisico_previo?: boolean;
  concurrencia?: boolean;
  aviso?: string;
  procura_id?: string;
  procura_ticket?: string;
  desviacion_usd?: number;
};

/** D-07: ingreso inventario + sync contable + vínculo procura en RPC Postgres. */
export async function completarIngresoAlmacenCompraAtomico(
  supabase: SupabaseClient,
  params: {
    purchaseInvoiceId: string;
    numeroFactura: string;
    proveedorRif?: string | null;
    proveedorNombre: string;
    fechaEmision: string;
    subtotal?: number;
    impuesto?: number;
    total: number;
    ubicacionDestinoId: string;
    documentoStoragePath?: string | null;
    condicion_pago?: string;
    dias_credito?: number | null;
    lineas: LineaCompraInventarioInput[];
  },
): Promise<ResultadoIngresoAlmacenAtomico> {
  const lineas = params.lineas.map((l) => ({
    material_id: l.material_id,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    requiere_serie: Boolean(l.requiere_serie),
  }));

  const { data, error } = await supabase.rpc(
    'ci_completar_ingreso_almacen_compra' as 'ci_registrar_ingreso_manual_campo',
    {
      p_purchase_invoice_id: params.purchaseInvoiceId.trim(),
      p_numero_factura: params.numeroFactura.trim() || 'S/N',
      p_proveedor_rif: (params.proveedorRif ?? 'S/R').trim() || 'S/R',
      p_proveedor_nombre: params.proveedorNombre.trim() || 'Proveedor',
      p_fecha_emision: params.fechaEmision.slice(0, 10),
      p_subtotal: params.subtotal ?? null,
      p_impuesto: params.impuesto ?? 0,
      p_total: params.total,
      p_ubicacion_destino_id: params.ubicacionDestinoId,
      p_documento_storage_path: params.documentoStoragePath?.trim() || null,
      p_condicion_pago: params.condicion_pago ?? 'contado',
      p_dias_credito: params.dias_credito ?? null,
      p_lineas: lineas,
    } as never,
  );

  if (error) {
    const msg = error.message ?? 'Error en ingreso almacén atómico';
    if (/ci_completar_ingreso_almacen_compra|does not exist/i.test(msg)) {
      return { success: false, yaExistia: false, rpcNoDisponible: true, error: msg };
    }
    return { success: false, yaExistia: false, error: msg };
  }

  const row = (data ?? {}) as RpcIngresoRow;
  return {
    success: Boolean(row.success),
    yaExistia: Boolean(row.ya_existia),
    compraFacturaId: row.compra_factura_id ? String(row.compra_factura_id) : undefined,
    ingresoFisicoPrevio: Boolean(row.ingreso_fisico_previo),
    concurrencia: Boolean(row.concurrencia),
    aviso: row.aviso ? String(row.aviso) : undefined,
    procuraId: row.procura_id ? String(row.procura_id) : undefined,
    procuraTicket: row.procura_ticket ? String(row.procura_ticket) : undefined,
    desviacionUsd:
      row.desviacion_usd != null && Number.isFinite(Number(row.desviacion_usd))
        ? Number(row.desviacion_usd)
        : undefined,
  };
}
