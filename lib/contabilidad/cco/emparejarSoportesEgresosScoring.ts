/**
 * Scoring puro: factura OCR ↔ egreso CCO (sin Gemini).
 * Seguro para importar desde componentes cliente.
 */

export const UMBRAL_AUTO = 78;
export const UMBRAL_DUDA = 42;
export const MARGEN_AUTO_VS_SEGUNDO = 12;
export const MAX_SOPORTES_POR_REQUEST = 10;
export const MAX_BYTES_SOPORTE = 12 * 1024 * 1024;

export type EgresoCandidatoSoporte = {
  id: string;
  proveedor: string;
  fecha: string | null;
  moneda: string;
  monto_orig: number;
  monto_base_usd: number;
  tasa: number;
  invoice_number?: string | null;
  display_id?: number | string;
};

export type FacturaCabeceraMatch = {
  supplier_name: string;
  date: string;
  total_amount: number | null;
  invoice_number: string;
};

export type DesgloseMatch = {
  proveedor: number;
  fecha: number;
  monto: number;
  invoice: number;
};

export type CandidatoScore = {
  egresoId: string;
  score: number;
  desglose: DesgloseMatch;
  motivo: string;
};

export type DecisionMatch = 'auto' | 'duda' | 'sin_match';

function normToken(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function tokensProveedor(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !['caxa', 'ca', 'sa', 'srl', 'cia', 'compania', 'de', 'del', 'la', 'el'].includes(t),
    );
}

function scoreProveedor(leido: string, candidato: string): number {
  const a = normToken(leido);
  const b = normToken(candidato);
  if (!a || !b) return 0;
  if (a === b) return 40;
  if (a.includes(b) || b.includes(a)) return 34;
  const ta = tokensProveedor(leido);
  const tb = tokensProveedor(candidato);
  if (ta.length === 0 || tb.length === 0) {
    const pref = Math.min(8, a.length, b.length);
    if (pref >= 5 && a.slice(0, pref) === b.slice(0, pref)) return 18;
    return 0;
  }
  let hits = 0;
  for (const t of ta) {
    if (tb.some((u) => u === t || u.includes(t) || t.includes(u))) hits += 1;
  }
  const ratio = hits / Math.max(ta.length, tb.length);
  if (ratio >= 0.75) return 32;
  if (ratio >= 0.5) return 24;
  if (ratio >= 0.33) return 14;
  if (hits >= 1) return 8;
  return 0;
}

function parseFecha(raw: string | null | undefined): Date | null {
  const s = String(raw ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function scoreFecha(leido: string, candidato: string | null): number {
  const a = parseFecha(leido);
  const b = parseFecha(candidato);
  if (!a || !b) return 0;
  const diffDays = Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDays < 0.5) return 30;
  if (diffDays <= 1) return 24;
  if (diffDays <= 3) return 16;
  if (diffDays <= 7) return 8;
  return 0;
}

function scoreMonto(totalOcr: number | null, egreso: EgresoCandidatoSoporte): number {
  if (totalOcr == null || !(totalOcr > 0)) return 0;

  const candidatos: number[] = [];
  const mon = (egreso.moneda || 'USD').toUpperCase();
  if (egreso.monto_orig > 0) candidatos.push(egreso.monto_orig);
  if (egreso.monto_base_usd > 0) candidatos.push(egreso.monto_base_usd);
  if (mon === 'USD' && egreso.tasa > 0 && egreso.monto_base_usd > 0) {
    candidatos.push(egreso.monto_base_usd * egreso.tasa);
  }
  if (mon === 'VES' && egreso.tasa > 0 && egreso.monto_orig > 0) {
    candidatos.push(egreso.monto_orig / egreso.tasa);
  }

  let bestRel = Infinity;
  for (const c of candidatos) {
    if (!(c > 0)) continue;
    const rel = Math.abs(totalOcr - c) / Math.max(totalOcr, c);
    if (rel < bestRel) bestRel = rel;
  }
  if (!Number.isFinite(bestRel)) return 0;
  if (bestRel <= 0.01) return 30;
  if (bestRel <= 0.03) return 24;
  if (bestRel <= 0.05) return 18;
  if (bestRel <= 0.08) return 12;
  if (bestRel <= 0.12) return 6;
  return 0;
}

function scoreInvoice(leido: string, candidato: string | null | undefined): number {
  const a = normToken(leido);
  const b = normToken(candidato ?? '');
  if (!a || !b) return 0;
  if (a === b) return 10;
  if (a.includes(b) || b.includes(a)) return 6;
  return 0;
}

function motivoDesdeDesglose(d: DesgloseMatch, proveedor: string): string {
  const partes: string[] = [];
  if (d.proveedor >= 24) partes.push(`proveedor «${proveedor}»`);
  else if (d.proveedor >= 8) partes.push('proveedor parcial');
  if (d.fecha >= 24) partes.push('misma fecha');
  else if (d.fecha >= 8) partes.push('fecha cercana');
  if (d.monto >= 18) partes.push('monto alineado');
  else if (d.monto >= 6) partes.push('monto aproximado');
  if (d.invoice >= 6) partes.push('nº factura');
  return partes.length > 0 ? partes.join(' · ') : 'Poca coincidencia';
}

export function puntuarEgresoContraFactura(
  factura: FacturaCabeceraMatch,
  egreso: EgresoCandidatoSoporte,
): CandidatoScore {
  const desglose: DesgloseMatch = {
    proveedor: scoreProveedor(factura.supplier_name, egreso.proveedor),
    fecha: scoreFecha(factura.date, egreso.fecha),
    monto: scoreMonto(factura.total_amount, egreso),
    invoice: scoreInvoice(factura.invoice_number, egreso.invoice_number),
  };
  const score = Math.min(
    100,
    desglose.proveedor + desglose.fecha + desglose.monto + desglose.invoice,
  );
  return {
    egresoId: egreso.id,
    score,
    desglose,
    motivo: motivoDesdeDesglose(desglose, egreso.proveedor),
  };
}

function clasificarDecision(ranked: CandidatoScore[]): {
  decision: DecisionMatch;
  egresoId: string | null;
  motivo: string;
} {
  const best = ranked[0];
  if (!best || best.score < UMBRAL_DUDA) {
    return {
      decision: 'sin_match',
      egresoId: null,
      motivo: best
        ? `Confianza baja (${best.score}). ${best.motivo}`
        : 'Sin candidatos en el cuadro',
    };
  }

  const second = ranked[1];
  const tresClavesFuertes =
    best.desglose.proveedor >= 24 &&
    best.desglose.fecha >= 16 &&
    best.desglose.monto >= 18;
  const claro =
    best.score >= UMBRAL_AUTO &&
    tresClavesFuertes &&
    (!second || best.score - second.score >= MARGEN_AUTO_VS_SEGUNDO);

  if (claro) {
    return {
      decision: 'auto',
      egresoId: best.egresoId,
      motivo: `Match claro: ${best.motivo}`,
    };
  }

  const empate =
    second &&
    second.score >= UMBRAL_DUDA &&
    best.score - second.score < MARGEN_AUTO_VS_SEGUNDO;

  return {
    decision: 'duda',
    egresoId: best.egresoId,
    motivo: empate
      ? `Empate o duda entre varios egresos. Mejor: ${best.motivo}`
      : `Requiere confirmación humana. ${best.motivo} (${best.score})`,
  };
}

export function decidirMatchFacturaEgresos(
  factura: FacturaCabeceraMatch,
  egresos: EgresoCandidatoSoporte[],
): {
  decision: DecisionMatch;
  egresoId: string | null;
  confianza: number;
  candidatos: CandidatoScore[];
  motivo: string;
} {
  const ranked = egresos
    .map((e) => puntuarEgresoContraFactura(factura, e))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const { decision, egresoId, motivo } = clasificarDecision(ranked);
  return {
    decision,
    egresoId,
    confianza: ranked[0]?.score ?? 0,
    candidatos: ranked,
    motivo,
  };
}
