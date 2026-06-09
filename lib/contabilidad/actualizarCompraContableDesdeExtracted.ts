import type { SupabaseClient } from '@supabase/supabase-js';
import {
  auditoriaFechaCompra,
  exigeConfirmacionFechaAnomala,
  FechaCompraAnomalaError,
  type AuditoriaFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import { updateContabilidadCompraRow } from '@/lib/contabilidad/updateContabilidadCompraRow';
import {
  monedaExtractedConfirmada,
  normalizarMonedaExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import { monedaOriginalCompra } from '@/lib/contabilidad/monedaCompra';

type LineaDb = {
  id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  descripcion?: string | null;
  item_code?: string | null;
};

type CompraDb = {
  id: string;
  fecha: string;
  purchase_invoice_id: string | null;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_rif: string | null;
  tasa_bcv_ves_por_usd: number | null;
  moneda: string | null;
  moneda_original: string | null;
  total_amount: number;
};

function lineasInputDesdeExtracted(ex: ExtractedCanalHeader) {
  return (ex.items ?? [])
    .filter((it) => String(it.description ?? '').trim())
    .map((it) => {
      const cantidad = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      const precio = Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0;
      return {
        descripcion: String(it.description ?? '').trim(),
        item_code: String(it.item_code ?? '').trim() || null,
        cantidad,
        precio_unitario: precio,
        subtotal: cantidad * precio,
      };
    });
}

export type ActualizarCompraContableDesdeExtractedInput = {
  compraId: string;
  extracted: ExtractedCanalHeader;
  confirmarFechaAnomala?: boolean;
  pendienteCanalId?: string | null;
};

export type ActualizarCompraContableDesdeExtractedResult = {
  audit: AuditoriaFechaCompra;
  compraId: string;
  fecha: string;
  tasaBcv: number;
  fechaCambio: boolean;
};

/**
 * Sincroniza cabecera, líneas y montos bimonetarios desde `extracted`.
 * Si cambia la fecha, recalcula la tasa BCV del día (ignora tasa previa).
 */
export async function actualizarCompraContableDesdeExtracted(
  supabase: SupabaseClient,
  input: ActualizarCompraContableDesdeExtractedInput,
): Promise<ActualizarCompraContableDesdeExtractedResult> {
  const { data: compraRaw, error: loadErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'id,fecha,purchase_invoice_id,invoice_number,supplier_name,supplier_rif,tasa_bcv_ves_por_usd,moneda,moneda_original,total_amount',
    )
    .eq('id', input.compraId)
    .maybeSingle();

  if (loadErr) throw new Error(loadErr.message);
  if (!compraRaw) throw new Error('Compra no encontrada');

  const compra = compraRaw as CompraDb;
  const extracted = input.extracted;

  const fecha =
    (extracted.date ?? '').trim().slice(0, 10) ||
    String(compra.fecha ?? '').slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  const audit = auditoriaFechaCompra(fecha);
  if (exigeConfirmacionFechaAnomala(audit) && !input.confirmarFechaAnomala) {
    throw new FechaCompraAnomalaError(audit);
  }

  const monedaNueva = monedaExtractedConfirmada(extracted.moneda)
    ? normalizarMonedaExtracted(extracted.moneda)
    : monedaOriginalCompra(compra);

  const lineasNuevas = lineasInputDesdeExtracted(extracted);
  if (!lineasNuevas.length) {
    throw new Error('Agregue al menos una línea con descripción.');
  }

  const sumLineas = lineasNuevas.reduce((s, l) => s + l.subtotal, 0);
  const totalManual =
    extracted.total_amount != null && Number(extracted.total_amount) > 0
      ? Number(extracted.total_amount)
      : sumLineas;

  const fechaAnterior = String(compra.fecha ?? '').slice(0, 10);
  const fechaCambio = fecha !== fechaAnterior;
  const monedaAnterior = monedaOriginalCompra(compra);
  const monedaCambio = monedaNueva !== monedaAnterior;

  const montos = await resolverMontosCompraBimonetario({
    montoTotal: totalManual,
    moneda: monedaNueva,
    fecha,
    tasaBcvDigitada: fechaCambio || monedaCambio ? null : compra.tasa_bcv_ves_por_usd,
  });

  const invoiceNumber = String(extracted.invoice_number ?? compra.invoice_number ?? 'S/N')
    .trim()
    .slice(0, 80);
  const supplierName = String(extracted.supplier_name ?? compra.supplier_name ?? 'Proveedor')
    .trim()
    .slice(0, 200);
  const supplierRif = String(extracted.supplier_rif ?? compra.supplier_rif ?? 'S/R')
    .trim()
    .slice(0, 40);

  const patchCompra: Record<string, unknown> = {
    invoice_number: invoiceNumber,
    supplier_name: supplierName,
    supplier_rif: supplierRif,
    fecha,
    ...payloadCompraBimonetario(montos),
  };

  const patchAuditoria: Record<string, unknown> = {
    alerta_fecha: audit.nivel === 'ok' ? null : audit.nivel,
    fecha_confirmada_manual:
      audit.nivel === 'critico' ? Boolean(input.confirmarFechaAnomala) : false,
  };

  const { error: upCompraErr } = await updateContabilidadCompraRow(supabase, input.compraId, {
    ...patchCompra,
    ...patchAuditoria,
  });
  if (upCompraErr?.message?.includes('alerta_fecha')) {
    const { error: retryErr } = await updateContabilidadCompraRow(
      supabase,
      input.compraId,
      patchCompra,
    );
    if (retryErr) throw new Error(retryErr.message);
  } else if (upCompraErr) {
    throw new Error(upCompraErr.message);
  }

  const { data: lineasDb, error: lnErr } = await supabase
    .from('contabilidad_compra_lineas')
    .select('id,cantidad,precio_unitario,subtotal,descripcion,item_code')
    .eq('compra_id', input.compraId)
    .order('id', { ascending: true });

  if (lnErr) throw new Error(lnErr.message);
  const lineas = (lineasDb ?? []) as LineaDb[];

  for (let i = 0; i < lineasNuevas.length; i++) {
    const src = lineasNuevas[i]!;
    const existente = lineas[i];
    const row = {
      descripcion: src.descripcion,
      item_code: src.item_code,
      cantidad: src.cantidad,
      precio_unitario: src.precio_unitario,
      subtotal: src.subtotal,
    };
    if (existente?.id) {
      const { error: upLnErr } = await supabase
        .from('contabilidad_compra_lineas')
        .update(row as never)
        .eq('id', existente.id);
      if (upLnErr) throw new Error(upLnErr.message);
    } else {
      const { error: insLnErr } = await supabase.from('contabilidad_compra_lineas').insert({
        compra_id: input.compraId,
        ...row,
        unidad: 'UND',
      } as never);
      if (insLnErr) throw new Error(insLnErr.message);
    }
  }

  for (let i = lineasNuevas.length; i < lineas.length; i++) {
    const extra = lineas[i];
    if (!extra?.id) continue;
    await supabase.from('contabilidad_compra_lineas').delete().eq('id', extra.id);
  }

  const piId = compra.purchase_invoice_id?.trim();
  if (piId) {
    const { error: piErr } = await supabase
      .from('purchase_invoices')
      .update({
        invoice_number: invoiceNumber,
        supplier_name: supplierName,
        supplier_rif: supplierRif,
        date: fecha,
        ...payloadCompraBimonetario(montos),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', piId);
    if (piErr) {
      console.warn('[actualizarCompraContable] purchase_invoices:', piErr.message);
    }
  }

  const pendienteId = input.pendienteCanalId?.trim();
  if (pendienteId) {
    const { error: canalErr } = await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        extracted: { ...extracted, date: fecha, moneda: monedaNueva },
        mensaje_error: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', pendienteId);
    if (canalErr) {
      console.warn('[actualizarCompraContable] canal:', canalErr.message);
    }
  }

  return {
    audit,
    compraId: input.compraId,
    fecha,
    tasaBcv: montos.tasaApplied,
    fechaCambio,
  };
}
