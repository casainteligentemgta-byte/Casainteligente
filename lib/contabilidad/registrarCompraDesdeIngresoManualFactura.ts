import type { SupabaseClient } from '@supabase/supabase-js';
import { buscarPrecioHistoricoUnitarioUsd } from '@/lib/compras/precioHistoricoMaterialProcura';
import {
  buscarCompraContablePorFactura,
  buscarPendienteCanalDuplicado,
} from '@/lib/contabilidad/buscarCompraContablePorFactura';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import type { LineaCompraContabilidadInput } from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import { registerCompraDesdeRecepcion } from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { sincronizarContabilidadTrasInventarioCompra } from '@/lib/contabilidad/sincronizarLogisticaCompraContable';
import { updateContabilidadCompraRow } from '@/lib/contabilidad/updateContabilidadCompraRow';
import { vincularProcuraCompraContabilidad } from '@/lib/procuras/vincularProcuraCompra';

export type LineaIngresoManualFacturaContabilidad = {
  material_id: string;
  material_nombre: string;
  unidad: string;
  cantidad: number;
};

export type ResultadoRegistroCompraIngresoManualFactura =
  | { ok: true; compraId: string; purchaseInvoiceId: string; yaExistia: boolean; provisional?: boolean }
  | { ok: false; error: string };

export type TipoRecepcionCampoContabilidad = 'factura_canal' | 'nota_entrega' | 'emergencia';

function numeroDocumentoContabilidad(
  tipo: TipoRecepcionCampoContabilidad,
  numDoc: string,
): string {
  const doc = numDoc.trim() || 'S/N';
  if (tipo === 'nota_entrega') return doc.startsWith('NE-') ? doc : `NE-${doc}`;
  if (tipo === 'emergencia') return doc.startsWith('EMG-') ? doc : `EMG-${doc}`;
  return doc;
}

function origenContabilidadDesdeRecepcion(tipo: TipoRecepcionCampoContabilidad): string {
  if (tipo === 'nota_entrega') return 'FRM_NOTA';
  if (tipo === 'emergencia') return 'FRM_EMERGENCIA';
  return 'TELEGRAM';
}

async function cargarItemCodes(
  supabase: SupabaseClient,
  materialIds: string[],
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(materialIds.filter(Boolean))).slice(0, 200);
  if (!ids.length) return new Map();

  const { data } = await supabase
    .from('global_inventory')
    .select('id, sku')
    .in('id', ids);

  return new Map(
    (data ?? []).map((r) => [String(r.id), String(r.sku ?? '').trim() || null]),
  );
}

async function resolverPrecioUnitarioProvisionalUsd(
  supabase: SupabaseClient,
  linea: LineaIngresoManualFacturaContabilidad,
  procuraPrecioUnitarioUsd: number | null,
): Promise<{ precio: number; fuente: 'procura' | 'historico' | 'sin_dato' }> {
  if (procuraPrecioUnitarioUsd != null && procuraPrecioUnitarioUsd > 0) {
    return { precio: procuraPrecioUnitarioUsd, fuente: 'procura' };
  }

  const hist = await buscarPrecioHistoricoUnitarioUsd(supabase, {
    materialId: linea.material_id,
    descripcionMaterial: linea.material_nombre,
  });
  if (hist.precio?.precioUnitarioUsd && hist.precio.precioUnitarioUsd > 0) {
    return { precio: hist.precio.precioUnitarioUsd, fuente: 'historico' };
  }

  return { precio: 0, fuente: 'sin_dato' };
}

async function lineasContabilidadDesdeIngreso(
  supabase: SupabaseClient,
  lineas: LineaIngresoManualFacturaContabilidad[],
  itemCodes: Map<string, string | null>,
  procuraPrecioUnitarioUsd: number | null,
): Promise<LineaCompraContabilidadInput[]> {
  const filtradas = lineas.filter((l) => l.material_id?.trim() && l.cantidad > 0);
  const out: LineaCompraContabilidadInput[] = [];

  for (const l of filtradas) {
    const { precio } = await resolverPrecioUnitarioProvisionalUsd(
      supabase,
      l,
      procuraPrecioUnitarioUsd,
    );
    out.push({
      material_id: l.material_id.trim(),
      descripcion: l.material_nombre.trim() || 'Material',
      item_code: itemCodes.get(l.material_id.trim()) ?? null,
      unidad: l.unidad.trim() || 'UND',
      cantidad: l.cantidad,
      precio_unitario: precio,
    });
  }

  return out;
}

async function cargarPrecioUnitarioDesdeProcura(
  supabase: SupabaseClient,
  procuraId: string | null | undefined,
): Promise<number | null> {
  const id = procuraId?.trim();
  if (!id) return null;

  const { data } = await supabase
    .from('ci_procuras')
    .select('monto_estimado_usd, cantidad')
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;
  const monto = Number(data.monto_estimado_usd);
  const cant = Number(data.cantidad);
  if (!Number.isFinite(monto) || !Number.isFinite(cant) || cant <= 0 || monto <= 0) {
    return null;
  }
  return monto / cant;
}

async function actualizarCantidadesLineasContabilidad(
  supabase: SupabaseClient,
  compraId: string,
  lineas: LineaCompraContabilidadInput[],
): Promise<void> {
  const { data: existentes } = await supabase
    .from('contabilidad_compra_lineas')
    .select('id, material_id, precio_unitario')
    .eq('compra_id', compraId);

  const porMaterial = new Map(
    (existentes ?? []).map((r) => [String(r.material_id ?? ''), r]),
  );

  for (const l of lineas) {
    const matId = l.material_id?.trim();
    if (!matId) continue;
    const prev = porMaterial.get(matId);
    if (prev) {
      const precio = Number(prev.precio_unitario) || l.precio_unitario || 0;
      await supabase
        .from('contabilidad_compra_lineas')
        .update({ cantidad: l.cantidad, subtotal: l.cantidad * precio })
        .eq('id', prev.id);
    } else {
      await supabase.from('contabilidad_compra_lineas').insert({
        compra_id: compraId,
        material_id: matId,
        descripcion: l.descripcion,
        item_code: l.item_code ?? null,
        unidad: l.unidad || 'UND',
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal: l.cantidad * l.precio_unitario,
      });
    }
  }

  const { data: todas } = await supabase
    .from('contabilidad_compra_lineas')
    .select('subtotal')
    .eq('compra_id', compraId);
  const total = (todas ?? []).reduce((s, r) => s + (Number(r.subtotal) || 0), 0);
  if (total > 0) {
    await updateContabilidadCompraRow(supabase, compraId, { total_amount: total });
  }
}

async function sincronizarLineasComprasFactura(
  supabase: SupabaseClient,
  facturaId: string,
  lineas: LineaCompraContabilidadInput[],
): Promise<void> {
  const { data: existentes } = await supabase
    .from('compras_factura_lineas')
    .select('id, material_id')
    .eq('factura_id', facturaId);

  const porMaterial = new Map(
    (existentes ?? []).map((r) => [String(r.material_id ?? ''), r]),
  );

  for (const l of lineas) {
    const matId = l.material_id?.trim();
    if (!matId) continue;
    const prev = porMaterial.get(matId);
    if (prev) {
      await supabase
        .from('compras_factura_lineas')
        .update({ cantidad: l.cantidad })
        .eq('id', prev.id);
    } else {
      await supabase.from('compras_factura_lineas').insert({
        factura_id: facturaId,
        material_id: matId,
        descripcion: l.descripcion.trim().slice(0, 500) || 'Ítem',
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        requiere_serie: false,
      });
    }
  }
}

/**
 * Puente contable tras ingreso manual de factura (Telegram / recepción campo).
 * El stock ya se aplicó vía ci_registrar_ingreso_manual_campo; aquí solo refleja cantidades en compras.
 */
async function asegurarComprasFacturaSinStockExtra(
  supabase: SupabaseClient,
  params: {
    purchaseInvoiceId: string;
    ubicacionId: string;
    numeroFactura: string;
    proveedorNombre: string;
    fecha: string;
    lineas: LineaCompraContabilidadInput[];
    documentoStoragePath?: string | null;
    /** Stock ya ingresado vía ci_registrar_ingreso_manual_campo: no disparar trigger registrada. */
    stockYaIngresadoEnAlmacen?: boolean;
  },
): Promise<string> {
  const { data: existing } = await supabase
    .from('compras_facturas')
    .select('id')
    .eq('purchase_invoice_id', params.purchaseInvoiceId)
    .maybeSingle();

  if (existing?.id) {
    const facturaId = String(existing.id);
    await sincronizarLineasComprasFactura(supabase, facturaId, params.lineas);
    return facturaId;
  }

  const now = new Date().toISOString();
  const estadoFactura = params.stockYaIngresadoEnAlmacen ? 'borrador' : 'registrada';
  const { data: factura, error: fErr } = await supabase
    .from('compras_facturas')
    .insert({
      numero_factura: params.numeroFactura.trim().slice(0, 80) || 'S/N',
      proveedor_rif: 'S/R',
      proveedor_nombre: params.proveedorNombre.trim().slice(0, 200) || 'Proveedor',
      fecha_emision: params.fecha.slice(0, 10),
      subtotal: 0,
      impuesto: 0,
      total: 0,
      ubicacion_destino_id: params.ubicacionId,
      estado: estadoFactura,
      registrada_at: estadoFactura === 'registrada' ? now : null,
      updated_at: now,
      purchase_invoice_id: params.purchaseInvoiceId,
      documento_storage_path: params.documentoStoragePath ?? null,
    })
    .select('id')
    .single();

  if (fErr) throw new Error(fErr.message ?? 'No se pudo crear compras_facturas.');

  const facturaId = String((factura as { id: string }).id);
  await sincronizarLineasComprasFactura(supabase, facturaId, params.lineas);
  return facturaId;
}

export async function registrarCompraDesdeIngresoManualFactura(
  supabase: SupabaseClient,
  params: {
    recepcionCampoId: string;
    proyectoId: string;
    ubicacionId: string;
    entidadId?: string | null;
    proveedorNombre: string;
    numDoc: string;
    tipoRecepcion?: TipoRecepcionCampoContabilidad;
    lineas: LineaIngresoManualFacturaContabilidad[];
    soporteStoragePath?: string | null;
  },
): Promise<ResultadoRegistroCompraIngresoManualFactura> {
  try {
    const tipo = params.tipoRecepcion ?? 'factura_canal';
    /** Stock ya ingresado en almacén: contabilidad provisional hasta conciliación fiscal. */
    const esProvisional = true;
    const fecha = new Date().toISOString().slice(0, 10);
    const invoiceNumber = numeroDocumentoContabilidad(tipo, params.numDoc);
    const proveedorNombre = params.proveedorNombre.trim() || 'Proveedor';
    const origen = origenContabilidadDesdeRecepcion(tipo);

    const { data: recepcionMeta } = await supabase
      .from('ci_recepciones_campo')
      .select('procura_id')
      .eq('id', params.recepcionCampoId)
      .maybeSingle();
    const procuraId = String(recepcionMeta?.procura_id ?? '').trim() || null;
    const procuraPrecioUnitarioUsd = await cargarPrecioUnitarioDesdeProcura(supabase, procuraId);

    const lineasConta = await lineasContabilidadDesdeIngreso(
      supabase,
      params.lineas,
      await cargarItemCodes(
        supabase,
        params.lineas.map((l) => l.material_id),
      ),
      procuraPrecioUnitarioUsd,
    );

    if (!lineasConta.length) {
      return { ok: false, error: 'Sin líneas válidas para contabilidad.' };
    }

    const totalProvisionalUsd = lineasConta.reduce(
      (s, l) => s + l.cantidad * (Number(l.precio_unitario) || 0),
      0,
    );
    const lineasSinPrecio = lineasConta.filter((l) => !(Number(l.precio_unitario) > 0)).length;

    let entidadId = params.entidadId?.trim() || null;
    if (!entidadId) {
      entidadId = await resolverEntidadIdDesdeProyecto(supabase, params.proyectoId);
    }

    const existente = await buscarCompraContablePorFactura(supabase, {
      invoice_number: invoiceNumber,
      supplier_name: proveedorNombre,
      proyecto_id: params.proyectoId,
      ignorar_proyecto: true,
    });

    let purchaseInvoiceId = existente?.purchase_invoice_id?.trim() || '';
    let compraId = existente?.id?.trim() || '';
    let yaExistia = Boolean(compraId);

    const pendienteCanal = tipo === 'factura_canal'
      ? await buscarPendienteCanalDuplicado(supabase, {
          invoice_number: invoiceNumber,
          supplier_name: proveedorNombre,
        })
      : null;
    if (pendienteCanal?.purchase_invoice_id?.trim()) {
      purchaseInvoiceId = pendienteCanal.purchase_invoice_id.trim();
    }

    if (!purchaseInvoiceId) {
      const montos = await resolverMontosCompraBimonetario({
        montoTotal: 0,
        moneda: 'VES',
        fecha,
      });

      const { data: inv, error: invErr } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: invoiceNumber.slice(0, 80),
          supplier_rif: 'S/R',
          supplier_name: proveedorNombre.slice(0, 200),
          date: fecha,
          status: 'REGISTRADA',
          proyecto_id: params.proyectoId,
          ubicacion_destino_id: params.ubicacionId,
          ...(entidadId ? { entidad_id: entidadId } : {}),
          ...payloadCompraBimonetario(montos),
          document_storage_path: params.soporteStoragePath ?? null,
        })
        .select('id')
        .single();

      if (invErr) throw new Error(invErr.message ?? 'No se pudo crear purchase_invoices.');
      purchaseInvoiceId = String((inv as { id: string }).id);
    } else {
      await supabase
        .from('purchase_invoices')
        .update({
          proyecto_id: params.proyectoId,
          ubicacion_destino_id: params.ubicacionId,
          ...(entidadId ? { entidad_id: entidadId } : {}),
        })
        .eq('id', purchaseInvoiceId);
    }

    if (!compraId) {
      const reg = await registerCompraDesdeRecepcion(supabase, {
        purchase_invoice_id: purchaseInvoiceId,
        proyecto_id: params.proyectoId,
        invoice_number: invoiceNumber,
        supplier_rif: 'S/R',
        supplier_name: proveedorNombre,
        fecha,
        total_amount: totalProvisionalUsd > 0 ? totalProvisionalUsd : 0,
        moneda: totalProvisionalUsd > 0 ? 'USD' : 'VES',
        lineas: lineasConta,
        origen,
        ubicacion_destino_id: params.ubicacionId,
        entidad_id: entidadId,
        document_storage_path: params.soporteStoragePath ?? null,
        procura_id: procuraId,
      });
      compraId = reg.compraId;
      yaExistia = reg.yaExistia;
    }

    await actualizarCantidadesLineasContabilidad(supabase, compraId, lineasConta);

    const ingresadoAt = new Date().toISOString();
    const patchCompra: Record<string, unknown> = {
      ubicacion_destino_id: params.ubicacionId,
      origen,
      ingresado_almacen_at: ingresadoAt,
    };
    if (entidadId) patchCompra.entidad_id = entidadId;
    if (totalProvisionalUsd > 0) {
      patchCompra.total_amount = totalProvisionalUsd;
      patchCompra.moneda = 'USD';
    }
    if (!existente?.purchase_invoice_id?.trim()) {
      patchCompra.purchase_invoice_id = purchaseInvoiceId;
    }
    const { error: patchErr } = await updateContabilidadCompraRow(supabase, compraId, patchCompra);
    if (patchErr) throw new Error(patchErr.message);

    await asegurarComprasFacturaSinStockExtra(supabase, {
      purchaseInvoiceId,
      ubicacionId: params.ubicacionId,
      numeroFactura: invoiceNumber,
      proveedorNombre,
      fecha,
      lineas: lineasConta,
      documentoStoragePath: params.soporteStoragePath ?? null,
      stockYaIngresadoEnAlmacen: true,
    });

    await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);

    if (procuraId) {
      const vinculo = await vincularProcuraCompraContabilidad(supabase, {
        purchaseInvoiceId,
        procuraId,
        contabilidadCompraId: compraId,
        autoMatch: false,
      });
      if (!vinculo.ok && vinculo.error) {
        console.warn('[registrarCompraDesdeIngresoManualFactura] vinculo procura:', vinculo.error);
      }
    }

    const notaPrecio =
      lineasSinPrecio > 0
        ? ` · ${lineasSinPrecio} línea(s) sin precio ref. (provisional)`
        : totalProvisionalUsd > 0
          ? ` · Precio ref. USD ${totalProvisionalUsd.toFixed(2)} (provisional)`
          : '';
    const notaProvisional = esProvisional
      ? ' · Pendiente conciliación fiscal (factura posterior)'
      : '';
    const nota = `Contabilidad: compra ${compraId.slice(0, 8)}… · PI ${purchaseInvoiceId.slice(0, 8)}…${notaProvisional}${notaPrecio}`;
    const { data: recepcion } = await supabase
      .from('ci_recepciones_campo')
      .select('observaciones, factura_canal_pendiente_id')
      .eq('id', params.recepcionCampoId)
      .maybeSingle();
    const obsPrev = String(recepcion?.observaciones ?? '').trim();
    const obsNext = obsPrev ? `${obsPrev}\n${nota}` : nota;

    const { error: obsErr } = await supabase
      .from('ci_recepciones_campo')
      .update({
        observaciones: obsNext,
        updated_at: new Date().toISOString(),
        ...(pendienteCanal?.id && !recepcion?.factura_canal_pendiente_id
          ? { factura_canal_pendiente_id: pendienteCanal.id }
          : {}),
      } as never)
      .eq('id', params.recepcionCampoId);
    if (obsErr) {
      console.warn('[registrarCompraDesdeIngresoManualFactura] observaciones recepción', obsErr.message);
    }

    const { error: linkErr } = await supabase
      .from('ci_recepciones_campo')
      .update({
        contabilidad_compra_id: compraId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', params.recepcionCampoId);
    if (linkErr && !/contabilidad_compra_id|42703|schema cache/i.test(linkErr.message ?? '')) {
      throw new Error(linkErr.message ?? 'No se pudo enlazar recepción con contabilidad.');
    }

    return {
      ok: true,
      compraId,
      purchaseInvoiceId,
      yaExistia,
      provisional: esProvisional,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error al registrar compra contable.',
    };
  }
}
