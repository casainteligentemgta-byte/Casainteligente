/** Split de gasto CCO V4: Σ % = 100 → N filas con montos prorrateados. */

export type CcoSplitParte = {
  capitulo: string;
  subcapitulo?: string | null;
  pct: number;
};

export type CcoSplitResultado = {
  capitulo: string;
  subcapitulo: string | null;
  pct: number;
  monto_usd: number;
  descripcion: string;
};

export function validarSplits(partes: CcoSplitParte[]): { ok: true } | { ok: false; error: string } {
  if (!partes.length) return { ok: false, error: 'Agrega al menos un capítulo con %.' };
  let suma = 0;
  for (const p of partes) {
    const pct = Number(p.pct);
    if (!Number.isFinite(pct) || pct <= 0) {
      return { ok: false, error: `Porcentaje inválido en «${p.capitulo || 'sin capítulo'}».` };
    }
    if (!String(p.capitulo ?? '').trim()) {
      return { ok: false, error: 'Cada parte necesita un capítulo.' };
    }
    suma += pct;
  }
  if (Math.abs(suma - 100) > 0.05) {
    return { ok: false, error: `La suma de % debe ser 100 (ahora ${suma.toFixed(2)}).` };
  }
  return { ok: true };
}

/**
 * Materializa splits. El último tramo absorbe redondeo para que Σ montos = total.
 */
export function materializarSplits(
  montoTotalUsd: number,
  descripcionBase: string,
  partes: CcoSplitParte[],
): CcoSplitResultado[] {
  const total = Number(montoTotalUsd) || 0;
  const base = String(descripcionBase ?? '').trim() || 'Gasto';
  const valid = validarSplits(partes);
  if (!valid.ok) throw new Error(valid.error);

  const out: CcoSplitResultado[] = [];
  let acumulado = 0;
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    const pct = Number(p.pct);
    const esUltimo = i === partes.length - 1;
    let monto = esUltimo
      ? Math.round((total - acumulado) * 10000) / 10000
      : Math.round(total * (pct / 100) * 10000) / 10000;
    if (monto < 0) monto = 0;
    acumulado += monto;
    const cap = String(p.capitulo).trim();
    const sub = p.subcapitulo?.trim() || null;
    const pctLabel = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '');
    out.push({
      capitulo: cap,
      subcapitulo: sub,
      pct,
      monto_usd: monto,
      descripcion: `${base} (${pctLabel}%)`,
    });
  }
  return out;
}
