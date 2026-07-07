import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';
import type { CompraCondicionPago } from '@/types/inventario-obra';

export type ExtractedCanalItem = {
  description?: string;
  item_code?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
};

export function normalizarMonedaExtracted(moneda?: string | null): MonedaOrigen {
  const m = String(moneda ?? 'VES')
    .trim()
    .toUpperCase();
  return m === 'USD' ? 'USD' : 'VES';
}

/** true si el comprador ya indicó Bs o USD (no usar el default VES implícito). */
export function monedaExtractedConfirmada(
  moneda?: string | null,
  compradorConfirmo?: boolean | null,
): boolean {
  if (compradorConfirmo === true) return true;
  if (compradorConfirmo === false) return false;
  const m = String(moneda ?? '')
    .trim()
    .toUpperCase();
  return m === 'USD' || m === 'VES' || m === 'BS';
}

export function parseCondicionPagoExtracted(v: unknown): CompraCondicionPago {
  return String(v ?? '').trim().toLowerCase() === 'credito' ? 'credito' : 'contado';
}

/** true si el comprador ya indicó contado o crédito. */
export function condicionPagoExtractedConfirmada(
  v: unknown,
  compradorConfirmo?: boolean | null,
): boolean {
  if (compradorConfirmo === true) return true;
  if (compradorConfirmo === false) return false;
  const m = String(v ?? '').trim().toLowerCase();
  return m === 'contado' || m === 'credito';
}

export function etiquetaCondicionPagoExtracted(v: unknown): string {
  return parseCondicionPagoExtracted(v) === 'credito' ? 'Crédito' : 'Contado';
}

export function parseDiasCreditoExtracted(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

/** Crédito exige días > 0; contado no requiere dias_credito. */
export function diasCreditoExtractedValido(row: {
  condicion_pago?: unknown;
  dias_credito?: number | null;
}): boolean {
  if (parseCondicionPagoExtracted(row.condicion_pago) !== 'credito') return true;
  return parseDiasCreditoExtracted(row.dias_credito) != null;
}

export function formaPagoExtractedCompleta(row: {
  condicion_pago?: unknown;
  dias_credito?: number | null;
  comprador_confirmo_pago?: boolean | null;
}): boolean {
  return (
    condicionPagoExtractedConfirmada(row.condicion_pago, row.comprador_confirmo_pago) &&
    diasCreditoExtractedValido(row)
  );
}

export function simboloMonedaExtracted(moneda?: string | null): string {
  return normalizarMonedaExtracted(moneda) === 'USD' ? 'USD' : 'Bs';
}

export function formatTotalExtracted(
  extracted: Pick<ExtractedCanalHeader, 'total_amount' | 'moneda'>,
  opts?: { sinMoneda?: boolean },
): string {
  if (extracted.total_amount == null || !Number.isFinite(Number(extracted.total_amount))) {
    return '—';
  }
  const monto = String(extracted.total_amount);
  if (opts?.sinMoneda) return monto;
  if (!monedaExtractedConfirmada(extracted.moneda)) return `${monto} (indique moneda)`;
  return `${monto} ${simboloMonedaExtracted(extracted.moneda)}`;
}

export type ExtractedCanalHeader = {
  invoice_number?: string;
  supplier_name?: string;
  supplier_rif?: string;
  date?: string;
  total_amount?: number | null;
  /** Moneda del total y precios unitarios de líneas (por defecto VES). */
  moneda?: MonedaOrigen | string | null;
  /** Forma de pago indicada por el comprador tras el OCR. */
  condicion_pago?: CompraCondicionPago | string | null;
  dias_credito?: number | null;
  items?: ExtractedCanalItem[];
  modelUsed?: string;
  fromGemini?: boolean;
  /** nota_entrega_telegram cuando el depositario registró solo la nota de entrega. */
  document_kind?: string;
  /** La factura fiscal aún no fue cargada por contabilidad. */
  factura_pendiente?: boolean;
  /** Comprador confirmó fecha sospechosa en Telegram o contabilidad. */
  fecha_auditoria_confirmada?: boolean;
  /** El comprador eligió moneda en Telegram o en la app. */
  comprador_confirmo_moneda?: boolean;
  /** El comprador eligió contado/crédito en Telegram o en la app. */
  comprador_confirmo_pago?: boolean;
};

export type LineaFacturaCanalForm = {
  description: string;
  item_code: string;
  quantity: string;
  unit_price: string;
};

export type FacturaCanalForm = {
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  date: string;
  moneda: MonedaOrigen;
  total_amount: string;
  items: LineaFacturaCanalForm[];
};

export function formDesdeExtracted(ex: ExtractedCanalHeader | null): FacturaCanalForm {
  const items = (ex?.items ?? []).map((it) => ({
    description: String(it.description ?? '').trim(),
    item_code: String(it.item_code ?? '').trim(),
    quantity: String(it.quantity ?? 1),
    unit_price: String(it.unit_price ?? 0),
  }));
  return {
    invoice_number: String(ex?.invoice_number ?? '').trim(),
    supplier_name: String(ex?.supplier_name ?? '').trim(),
    supplier_rif: String(ex?.supplier_rif ?? '').trim(),
    date: (ex?.date ?? '').slice(0, 10),
    moneda: normalizarMonedaExtracted(ex?.moneda),
    total_amount:
      ex?.total_amount != null && Number.isFinite(Number(ex.total_amount))
        ? String(ex.total_amount)
        : '',
    items: items.length ? items : [lineaVacia()],
  };
}

export function lineaVacia(): LineaFacturaCanalForm {
  return { description: '', item_code: '', quantity: '1', unit_price: '0' };
}

export function extractedDesdeForm(
  form: FacturaCanalForm,
  prev: ExtractedCanalHeader | null,
): ExtractedCanalHeader {
  const items = form.items
    .filter((l) => l.description.trim())
    .map((l) => ({
      description: l.description.trim(),
      item_code: l.item_code.trim() || undefined,
      unit: 'UND',
      quantity: Math.max(0, Number(l.quantity) || 0),
      unit_price: Math.max(0, Number(l.unit_price) || 0),
    }));

  const sumLineas = items.reduce((s, it) => s + (it.quantity ?? 0) * (it.unit_price ?? 0), 0);
  const totalManual = parseMonto(form.total_amount);
  const total_amount = totalManual != null ? totalManual : sumLineas;

  return {
    ...prev,
    invoice_number: form.invoice_number.trim() || undefined,
    supplier_name: form.supplier_name.trim() || undefined,
    supplier_rif: form.supplier_rif.trim() || undefined,
    date: form.date.trim().slice(0, 10) || undefined,
    moneda: form.moneda,
    total_amount,
    items,
  };
}

function parseMonto(s: string): number | null {
  const n = Number(String(s).replace(',', '.').trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Arma `extracted` editable desde una fila unificada de compras (Telegram). */
export function extractedDesdeCompraLista(c: {
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  fecha: string;
  total_amount: number;
  moneda?: string | null;
  moneda_original?: string | null;
  contabilidad_compra_lineas?: Array<{
    descripcion: string;
    item_code: string | null;
    cantidad: number;
    precio_unitario?: number;
    subtotal: number;
  }>;
}): ExtractedCanalHeader {
  const lineas = c.contabilidad_compra_lineas ?? [];
  return {
    invoice_number: c.invoice_number,
    supplier_name: c.supplier_name,
    supplier_rif: c.supplier_rif,
    date: (c.fecha ?? '').slice(0, 10),
    moneda: normalizarMonedaExtracted(c.moneda_original ?? c.moneda),
    total_amount: c.total_amount,
    items: lineas.map((l) => {
      const cantidad = Number(l.cantidad) > 0 ? Number(l.cantidad) : 0;
      const precio =
        l.precio_unitario != null && l.precio_unitario >= 0
          ? l.precio_unitario
          : cantidad > 0
            ? Number(l.subtotal) / cantidad
            : 0;
      return {
        description: l.descripcion,
        item_code: l.item_code ?? undefined,
        quantity: cantidad,
        unit_price: precio,
      };
    }),
  };
}
