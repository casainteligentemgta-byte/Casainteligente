import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { actualizarCompraContableDesdeExtracted } from '@/lib/contabilidad/actualizarCompraContableDesdeExtracted';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import {
  monedaOriginalCompra,
  montoNominalMonedaOriginal,
  type FilaMonedaCompra,
} from '@/lib/contabilidad/monedaCompra';
import {
  formatearBs,
  formatearUsd,
  montoUsdCompra,
  montoVesCompra,
  tasaBcvCompra,
} from '@/lib/contabilidad/comprasMontos';
import { normalizarRifVenezolano } from '@/lib/contabilidad/rifVenezolano';
import { resolverTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

export type CampoCertificacionFactura = 'proveedor' | 'rif' | 'monto' | 'fecha';

export type DisparidadFacturaAdjunta = {
  campo: CampoCertificacionFactura;
  etiqueta: string;
  valor_cco: string;
  valor_factura: string;
  detalle: string;
};

export type CompraParaCertificar = FilaMonedaCompra & {
  id: string;
  fecha: string | null;
  supplier_name: string | null;
  supplier_rif: string | null;
  invoice_number: string | null;
  origen?: string | null;
};

export type DecisionCertificarFactura = 'mantener_cco' | 'usar_factura';

export type ResultadoComparacionFactura = {
  coincide: boolean;
  disparidades: DisparidadFacturaAdjunta[];
  /** Monto OCR interpretado en USD (si se pudo). */
  monto_factura_usd: number | null;
  /** Monto OCR en Bs. */
  monto_factura_ves: number | null;
  tasa_comparacion: number | null;
  /** Nº leído en la factura (vacío si el OCR no lo trajo). */
  invoice_number_factura: string | null;
  /** True si hace falta pedirlo a mano (OCR vacío o solo correlativo CCO). */
  requiere_numero_factura: boolean;
};

/** Correlativo sintético del import CSV (`CCO-V4-123`), no es nº fiscal real. */
export function esNumeroFacturaSinteticoCco(raw: string | null | undefined): boolean {
  return /^CCO-V4-\d+$/i.test(String(raw ?? '').trim());
}

/**
 * Nº de factura real: manual > OCR > null.
 * Nunca reutiliza el correlativo CCO-V4 del CSV.
 */
export function resolverNumeroFacturaAdjunta(input: {
  invoiceNumberOcr?: string | null;
  invoiceNumberManual?: string | null;
  invoiceNumberCompra?: string | null;
}): string | null {
  const manual = String(input.invoiceNumberManual ?? '').trim();
  if (manual && !esNumeroFacturaSinteticoCco(manual)) return manual.slice(0, 80);

  const ocr = String(input.invoiceNumberOcr ?? '').trim();
  if (ocr && !esNumeroFacturaSinteticoCco(ocr)) return ocr.slice(0, 80);

  const compra = String(input.invoiceNumberCompra ?? '').trim();
  if (compra && !esNumeroFacturaSinteticoCco(compra)) return compra.slice(0, 80);

  return null;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Normaliza razón social para comparar (sin C.A., S.A., etc.). */
export function normalizarNombreProveedorComparacion(raw: string | null | undefined): string {
  return stripAccents(String(raw ?? ''))
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(
      /\b(CA|C A|SA|S A|SRL|S R L|CIA|COMPANIA|COMPAÑIA|INVERSIONES|DISTRIBUIDORA|COMERCIALIZADORA|C\.?A\.?|S\.?A\.?)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensSignificativos(nombre: string): string[] {
  return nombre
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

/** true si los nombres parecen el mismo proveedor. */
export function proveedoresCoinciden(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizarNombreProveedorComparacion(a);
  const nb = normalizarNombreProveedorComparacion(b);
  if (!na || !nb) return !na && !nb ? true : false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(tokensSignificativos(na));
  const tb = tokensSignificativos(nb);
  if (ta.size === 0 || tb.length === 0) return false;
  const hits = tb.filter((t) => ta.has(t)).length;
  const ratio = hits / Math.max(ta.size, tb.length);
  return hits >= 2 || ratio >= 0.6;
}

function montosCercanos(a: number, b: number, opts?: { abs?: number; pct?: number }): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return true;
  const abs = opts?.abs ?? 1;
  const pct = opts?.pct ?? 0.03;
  const diff = Math.abs(a - b);
  if (diff <= abs) return true;
  const base = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return diff / base <= pct;
}

function formatMonto(valor: number, moneda: 'USD' | 'VES'): string {
  return moneda === 'USD' ? formatearUsd(valor) : formatearBs(valor);
}

/**
 * Compara cabecera/monto CCO (CSV) vs OCR de la factura adjunta.
 * No compara nro. factura cuando el CCO usa correlativo sintético CCO-V4-*.
 */
export async function compararCabeceraConFacturaOcr(
  compra: CompraParaCertificar,
  extracted: Pick<
    ExtractedPurchaseInvoice,
    'supplier_name' | 'supplier_rif' | 'date' | 'total_amount' | 'invoice_number'
  >,
): Promise<ResultadoComparacionFactura> {
  const disparidades: DisparidadFacturaAdjunta[] = [];
  const fechaCompra = String(compra.fecha ?? '').slice(0, 10);
  const fechaOcr = String(extracted.date ?? '').trim().slice(0, 10);

  const monedaCco = monedaOriginalCompra(compra);
  const totalOcr = extracted.total_amount != null ? Number(extracted.total_amount) : null;
  let tasaNum = Number(tasaBcvCompra(compra)) || 0;
  if (tasaNum <= 0 && fechaCompra) {
    try {
      const r = await resolverTasaBcvVesPorUsd(fechaCompra, compra.tasa_bcv_ves_por_usd);
      tasaNum = Number(r.tasa_bcv_ves_por_usd) || 0;
    } catch {
      tasaNum = 0;
    }
  }

  let montoFacturaVes: number | null =
    totalOcr != null && Number.isFinite(totalOcr) && totalOcr > 0 ? totalOcr : null;
  let montoFacturaUsd: number | null = null;
  if (montoFacturaVes != null && tasaNum > 0) {
    montoFacturaUsd = Math.round((montoFacturaVes / tasaNum) * 100) / 100;
  }

  // Proveedor
  if (!proveedoresCoinciden(compra.supplier_name, extracted.supplier_name)) {
    disparidades.push({
      campo: 'proveedor',
      etiqueta: 'Proveedor',
      valor_cco: String(compra.supplier_name ?? '—').trim() || '—',
      valor_factura: String(extracted.supplier_name ?? '—').trim() || '—',
      detalle: 'El proveedor del CSV CCO no coincide con el emisor de la factura.',
    });
  }

  // RIF (solo si ambos existen)
  const rifCco = normalizarRifVenezolano(compra.supplier_rif);
  const rifOcr = normalizarRifVenezolano(extracted.supplier_rif);
  if (rifCco && rifOcr && rifCco !== rifOcr) {
    disparidades.push({
      campo: 'rif',
      etiqueta: 'RIF',
      valor_cco: rifCco,
      valor_factura: rifOcr,
      detalle: 'El RIF del egreso CCO no coincide con el de la factura.',
    });
  }

  // Monto: OCR viene en Bs; CCO suele estar en USD
  if (montoFacturaVes != null) {
    const vesCco = montoVesCompra(compra);
    const usdCco = montoUsdCompra(compra);
    const nominalCco = montoNominalMonedaOriginal(compra);

    let coincideMonto = false;
    let valorCcoLabel = '—';
    let valorFacturaLabel = formatMonto(montoFacturaVes, 'VES');

    if (monedaCco === 'VES') {
      coincideMonto = montosCercanos(nominalCco || vesCco, montoFacturaVes, {
        abs: 50,
        pct: 0.03,
      });
      valorCcoLabel = formatMonto(nominalCco || vesCco, 'VES');
    } else {
      // Preferir comparar en USD si hay tasa; si no, en Bs del CCO
      if (montoFacturaUsd != null && usdCco > 0) {
        coincideMonto = montosCercanos(usdCco, montoFacturaUsd, { abs: 1, pct: 0.03 });
        valorCcoLabel = formatMonto(usdCco, 'USD');
        valorFacturaLabel = `${formatMonto(montoFacturaVes, 'VES')} ≈ ${formatMonto(montoFacturaUsd, 'USD')}`;
      } else if (vesCco > 0) {
        coincideMonto = montosCercanos(vesCco, montoFacturaVes, { abs: 50, pct: 0.03 });
        valorCcoLabel = formatMonto(vesCco, 'VES');
      } else if (usdCco > 0 && tasaNum > 0) {
        coincideMonto = montosCercanos(usdCco, montoFacturaUsd ?? 0, { abs: 1, pct: 0.03 });
        valorCcoLabel = formatMonto(usdCco, 'USD');
        valorFacturaLabel = `${formatMonto(montoFacturaVes, 'VES')} ≈ ${formatMonto(montoFacturaUsd ?? 0, 'USD')}`;
      } else {
        // Sin tasa fiable: no forzar disparidad de monto si no podemos comparar
        coincideMonto = true;
      }
    }

    if (!coincideMonto) {
      disparidades.push({
        campo: 'monto',
        etiqueta: 'Monto',
        valor_cco: valorCcoLabel,
        valor_factura: valorFacturaLabel,
        detalle:
          'El monto del egreso CCO (CSV) no coincide con el total leído en la factura (tolerancia ~3%).',
      });
    }
  }

  // Fecha (solo si ambas válidas y difieren)
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(fechaCompra) &&
    /^\d{4}-\d{2}-\d{2}$/.test(fechaOcr) &&
    fechaCompra !== fechaOcr
  ) {
    disparidades.push({
      campo: 'fecha',
      etiqueta: 'Fecha',
      valor_cco: fechaCompra,
      valor_factura: fechaOcr,
      detalle: 'La fecha del egreso CCO no coincide con la de la factura.',
    });
  }

  const invoiceOcr = String(extracted.invoice_number ?? '').trim() || null;
  const invoiceReal =
    invoiceOcr && !esNumeroFacturaSinteticoCco(invoiceOcr) ? invoiceOcr : null;
  const requiereNumero = !invoiceReal;

  return {
    coincide: disparidades.length === 0,
    disparidades,
    monto_factura_usd: montoFacturaUsd,
    monto_factura_ves: montoFacturaVes,
    tasa_comparacion: tasaNum > 0 ? tasaNum : null,
    invoice_number_factura: invoiceReal,
    requiere_numero_factura: requiereNumero,
  };
}

export function extractedCanalDesdeOcr(
  extracted: ExtractedPurchaseInvoice,
  moneda: 'VES' | 'USD' = 'VES',
): ExtractedCanalHeader {
  return {
    invoice_number: extracted.invoice_number,
    supplier_name: extracted.supplier_name,
    supplier_rif: extracted.supplier_rif,
    date: extracted.date,
    total_amount: extracted.total_amount,
    moneda,
    items: (extracted.items ?? []).map((it) => ({
      description: it.description,
      item_code: it.item_code,
      unit: it.unit,
      quantity: it.quantity,
      unit_price: it.unit_price,
    })),
  };
}

/**
 * Convierte precios OCR (Bs) a USD con la tasa dada, para mantener cabecera CCO en USD.
 */
export function convertirExtractedBsAUsd(
  extracted: ExtractedPurchaseInvoice,
  tasa: number,
  totalUsdObjetivo?: number | null,
): ExtractedCanalHeader {
  const t = Number(tasa);
  const safeTasa = Number.isFinite(t) && t > 0 ? t : 0;
  const itemsBs = (extracted.items ?? []).filter((it) => String(it.description ?? '').trim());
  const sumBs = itemsBs.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0,
  );

  let items = itemsBs.map((it) => {
    const cantidad = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
    const puBs = Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0;
    const puUsd =
      safeTasa > 0 ? Math.round((puBs / safeTasa) * 10000) / 10000 : puBs;
    return {
      description: it.description,
      item_code: it.item_code,
      unit: it.unit,
      quantity: cantidad,
      unit_price: puUsd,
    };
  });

  const objetivo =
    totalUsdObjetivo != null && Number.isFinite(totalUsdObjetivo) && totalUsdObjetivo > 0
      ? Number(totalUsdObjetivo)
      : null;
  if (objetivo != null && items.length > 0) {
    const sumUsd = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    if (sumUsd > 0 && Math.abs(sumUsd - objetivo) / objetivo > 0.01) {
      const factor = objetivo / sumUsd;
      items = items.map((it) => ({
        ...it,
        unit_price: Math.round(it.unit_price * factor * 10000) / 10000,
      }));
    } else if (sumBs <= 0 && objetivo > 0) {
      // Sin precios útiles: una sola línea con el total CCO no — mantener descripciones a prorrata
      const n = items.length;
      const cada = Math.round((objetivo / n) * 100) / 100;
      items = items.map((it, idx) => ({
        ...it,
        quantity: 1,
        unit_price: idx === n - 1 ? Math.round((objetivo - cada * (n - 1)) * 100) / 100 : cada,
      }));
    }
  }

  const totalUsd =
    objetivo ??
    (safeTasa > 0 && extracted.total_amount
      ? Math.round((Number(extracted.total_amount) / safeTasa) * 100) / 100
      : items.reduce((s, it) => s + it.quantity * it.unit_price, 0));

  return {
    invoice_number: extracted.invoice_number,
    supplier_name: extracted.supplier_name,
    supplier_rif: extracted.supplier_rif,
    date: extracted.date,
    total_amount: totalUsd,
    moneda: 'USD',
    items,
  };
}

/**
 * Aplica la decisión de certificación: ítems siempre desde OCR;
 * cabecera/monto según `mantener_cco` o `usar_factura`.
 * El nº de factura siempre viene del OCR o de carga manual (nunca CCO-V4).
 */
export async function aplicarCertificacionFacturaAdjunta(
  supabase: SupabaseClient,
  input: {
    compra: CompraParaCertificar;
    extracted: ExtractedPurchaseInvoice;
    decision: DecisionCertificarFactura;
    confirmarFechaAnomala?: boolean;
    /** Nº fiscal indicado a mano si el OCR no lo trajo. */
    invoiceNumberManual?: string | null;
  },
): Promise<{
  compraId: string;
  decision: DecisionCertificarFactura;
  items: number;
  invoice_number: string;
}> {
  const { compra, extracted, decision } = input;
  const itemsCount = (extracted.items ?? []).filter((it) => String(it.description ?? '').trim())
    .length;
  if (itemsCount === 0) {
    throw new Error('La factura no tiene ítems legibles para cargar.');
  }

  const invoiceNumber = resolverNumeroFacturaAdjunta({
    invoiceNumberOcr: extracted.invoice_number,
    invoiceNumberManual: input.invoiceNumberManual,
    invoiceNumberCompra: compra.invoice_number,
  });
  if (!invoiceNumber) {
    throw new Error(
      'Indique el número de factura (el OCR no lo leyó y el CCO solo tiene correlativo interno).',
    );
  }

  const monedaCco = monedaOriginalCompra(compra);
  let payload: ExtractedCanalHeader;

  if (decision === 'usar_factura') {
    payload = extractedCanalDesdeOcr(extracted, 'VES');
  } else {
    // Mantener cabecera CCO: no pisar proveedor/monto/fecha del CSV
    if (monedaCco === 'USD') {
      let tasaNum = Number(tasaBcvCompra(compra)) || 0;
      if (tasaNum <= 0 && compra.fecha) {
        const r = await resolverTasaBcvVesPorUsd(
          String(compra.fecha).slice(0, 10),
          compra.tasa_bcv_ves_por_usd,
        );
        tasaNum = Number(r.tasa_bcv_ves_por_usd) || 0;
      }
      payload = convertirExtractedBsAUsd(extracted, tasaNum, montoUsdCompra(compra));
      payload.supplier_name = compra.supplier_name ?? payload.supplier_name;
      payload.supplier_rif = compra.supplier_rif ?? payload.supplier_rif;
      payload.date = String(compra.fecha ?? payload.date ?? '').slice(0, 10);
      payload.total_amount = montoUsdCompra(compra) || payload.total_amount;
      payload.moneda = 'USD';
    } else {
      payload = extractedCanalDesdeOcr(extracted, 'VES');
      payload.supplier_name = compra.supplier_name ?? payload.supplier_name;
      payload.supplier_rif = compra.supplier_rif ?? payload.supplier_rif;
      payload.date = String(compra.fecha ?? payload.date ?? '').slice(0, 10);
      payload.total_amount =
        montoNominalMonedaOriginal(compra) || payload.total_amount;
      payload.moneda = 'VES';
    }
  }

  // Siempre nº real de factura (OCR o manual), nunca correlativo CCO-V4.
  payload.invoice_number = invoiceNumber;

  await actualizarCompraContableDesdeExtracted(supabase, {
    compraId: compra.id,
    extracted: payload,
    confirmarFechaAnomala: Boolean(input.confirmarFechaAnomala),
  });

  return {
    compraId: compra.id,
    decision,
    items: itemsCount,
    invoice_number: invoiceNumber,
  };
}
