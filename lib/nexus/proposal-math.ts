/**
 * Cálculos de presupuesto Nexus Builder: subtotal, impuestos, descuentos y validación de margen.
 */

export type LineInput = {
  qty: number;
  unitPrice: number;
  discountPct: number;
  costPrice?: number | null;
};

export function lineSubtotal(line: LineInput): number {
  const gross = line.qty * line.unitPrice;
  return Math.round(gross * (1 - line.discountPct / 100) * 100) / 100;
}

export function sumLines(lines: LineInput[]): number {
  return Math.round(lines.reduce((s, l) => s + lineSubtotal(l), 0) * 100) / 100;
}

export function taxFromSubtotal(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * (taxRate / 100) * 100) / 100;
}

export function grandTotal(subtotal: number, taxAmount: number, discountTotal: number): number {
  return Math.round((subtotal + taxAmount - discountTotal) * 100) / 100;
}

/** Margen % agregado respecto a costo de líneas (si todas tienen costo). */
export function marginPercent(lines: { lineTotal: number; costPrice?: number | null; qty: number }[]): number | null {
  const withCost = lines.filter((l) => l.costPrice != null && l.costPrice > 0);
  if (withCost.length === 0) return null;
  let revenue = 0;
  let cost = 0;
  for (const l of withCost) {
    revenue += l.lineTotal;
    cost += (l.costPrice as number) * l.qty;
  }
  if (revenue <= 0) return null;
  return Math.round(((revenue - cost) / revenue) * 10000) / 100;
}

export function validateMinMargin(
  marginPct: number | null,
  minRequired: number | null | undefined,
): { ok: true } | { ok: false; message: string } {
  if (minRequired == null || minRequired <= 0) return { ok: true };
  if (marginPct == null) return { ok: false, message: 'Faltan costos para calcular el margen.' };
  if (marginPct < minRequired) {
    return {
      ok: false,
      message: `Margen ${marginPct.toFixed(1)}% por debajo del mínimo ${minRequired.toFixed(1)}%.`,
    };
  }
  return { ok: true };
}
