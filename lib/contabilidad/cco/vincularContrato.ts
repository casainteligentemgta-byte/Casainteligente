/** Vínculo CONTRATO_VINCULADO + fallback por descripción / proveedor. */

const TAG_RE = /\[([^\]]+)\]/g;

/** Tokens de dominio obra que pesan más al matchear (V4 Flamboyant / típicos). */
const TOKENS_PESO: Record<string, number> = {
  CICLOPEO: 3,
  MURO: 2,
  TEJAS: 3,
  MANTO: 2,
  ESTRUCTURA: 2,
  PISCINA: 3,
  JACUZZI: 3,
  ELECTRICIDAD: 3,
  PLOMERIA: 3,
  FUMIGACION: 3,
  AIRES: 2,
  ACONDICIONADOS: 2,
  CORPOELECT: 3,
  SUELOS: 2,
  GEOTECNICA: 2,
  MODULO: 1,
  FRISO: 2,
  PASTA: 2,
  INTERNET: 2,
};

const STOP = new Set([
  'DE',
  'DEL',
  'LA',
  'EL',
  'LOS',
  'LAS',
  'Y',
  'PARA',
  'CON',
  'POR',
  'EN',
  'AL',
  'UN',
  'UNA',
  'ABONO',
  'PAGO',
  'TRABAJO',
  'TRABAJOS',
  'MANO',
  'OBRA',
  'ETAPA',
]);

export function extraerTagsDescripcion(descripcion: string | null | undefined): string[] {
  const s = String(descripcion ?? '');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(TAG_RE.source, 'g');
  while ((m = re.exec(s)) != null) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}

export function normalizarTextoContrato(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\([^)]*%\)/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokensSignificativos(s: string): string[] {
  return normalizarTextoContrato(s)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function scoreVinculoDescripcion(pagoDesc: string, contratoDesc: string): number {
  const a = normalizarTextoContrato(pagoDesc);
  const b = normalizarTextoContrato(contratoDesc);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 90;

  const ta = tokensSignificativos(a);
  const tb = tokensSignificativos(b);
  if (!ta.length || !tb.length) return 0;

  const setB = new Set(tb);
  let pesoInter = 0;
  let pesoA = 0;
  for (const w of ta) {
    const p = TOKENS_PESO[w] ?? 1;
    pesoA += p;
    if (setB.has(w)) pesoInter += p;
  }
  let pesoB = 0;
  for (const w of tb) pesoB += TOKENS_PESO[w] ?? 1;

  const denom = Math.max(pesoA, pesoB) || 1;
  const jaccardPeso = pesoInter / denom;

  // Bonus si comparten módulo (A/B/C/D/E)
  const modA = a.match(/\bMODULO\s*([ABCDE])\b/);
  const modB = b.match(/\bMODULO\s*([ABCDE])\b/);
  let bonus = 0;
  if (modA && modB && modA[1] === modB[1]) bonus = 12;
  if (modA && modB && modA[1] !== modB[1]) bonus = -20;

  return Math.max(0, Math.min(95, Math.round(jaccardPeso * 80 + bonus)));
}

export type ContratoCandidato = {
  id: string;
  proveedor: string;
  descripcion: string;
};

export type ResolucionVinculo = {
  contrato: ContratoCandidato;
  score: number;
  motivo: string;
};

/**
 * Resuelve contrato para un pago: tag explícito → match por descripción mismo proveedor.
 * Si el proveedor tiene un solo contrato, acepta con umbral más bajo.
 */
export function resolverContratoVinculado(opts: {
  proveedor: string;
  descripcion: string;
  contratoVinculadoTexto?: string | null;
  contratos: ContratoCandidato[];
  umbral?: number;
}): ContratoCandidato | null {
  return resolverContratoVinculadoDetalle(opts)?.contrato ?? null;
}

export function resolverContratoVinculadoDetalle(opts: {
  proveedor: string;
  descripcion: string;
  contratoVinculadoTexto?: string | null;
  contratos: ContratoCandidato[];
  umbral?: number;
}): ResolucionVinculo | null {
  const contratos = opts.contratos;
  if (!contratos.length) return null;

  const texto = String(opts.contratoVinculadoTexto ?? '').trim();
  if (texto) {
    const n = normalizarTextoContrato(texto);
    const exact = contratos.find((c) => normalizarTextoContrato(c.descripcion) === n);
    if (exact) return { contrato: exact, score: 100, motivo: 'texto_explicito' };
    const partial = contratos.find((c) => {
      const cd = normalizarTextoContrato(c.descripcion);
      return cd.includes(n) || n.includes(cd);
    });
    if (partial) return { contrato: partial, score: 92, motivo: 'texto_parcial' };
  }

  for (const tag of extraerTagsDescripcion(opts.descripcion)) {
    const n = normalizarTextoContrato(tag);
    const hit = contratos.find((c) => normalizarTextoContrato(c.descripcion) === n);
    if (hit) return { contrato: hit, score: 100, motivo: 'tag' };
  }

  const prov = normalizarTextoContrato(opts.proveedor);
  const mismos = contratos.filter((c) => normalizarTextoContrato(c.proveedor) === prov);
  if (!mismos.length) return null;

  // Un solo contrato del proveedor → umbral más permisivo
  const umbralBase = opts.umbral ?? 45;
  const umbral = mismos.length === 1 ? Math.min(umbralBase, 28) : umbralBase;

  let best: ContratoCandidato | null = null;
  let bestScore = 0;
  for (const c of mismos) {
    const s = scoreVinculoDescripcion(opts.descripcion, c.descripcion);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (!best || bestScore < umbral) return null;
  return {
    contrato: best,
    score: bestScore,
    motivo: mismos.length === 1 ? 'unico_proveedor' : 'descripcion',
  };
}
