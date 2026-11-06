/**
 * Parser de la portada BCV (#dolar + Fecha Valor) y fechas Caracas.
 * Sin node:https: el cliente (useTasaBcvHoy) importa este módulo vía bcvTasaPorFecha.
 * El fetch TLS está en bcvOficialFetch.ts.
 */

export const BCV_OFICIAL_URL = 'https://www.bcv.org.ve/';
export const BCV_OFICIAL_HOSTS = new Set(['www.bcv.org.ve', 'bcv.org.ve']);
export const FUENTE_BCV_OFICIAL = 'bcv.org.ve' as const;

const MESES_ES: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

export type ParseoBcvOficial = {
  usd: number;
  fechaValor: string | null;
  fuente: typeof FUENTE_BCV_OFICIAL;
};

export function hoyIsoCaracas(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Interpreta montos BCV (897,53830000) y variantes con miles. */
export function parseNumeroTasaVe(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!s) return null;
  let n: number;
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    n =
      lastComma > lastDot
        ? Number(s.replace(/\./g, '').replace(',', '.'))
        : Number(s.replace(/,/g, ''));
  } else if (s.includes(',')) {
    n = Number(s.replace(',', '.'));
  } else {
    n = Number(s);
  }
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseFechaEspanolBcv(texto: string): string | null {
  const m =
    /(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(\d{4})/i.exec(
      texto,
    );
  if (!m) return null;
  const dia = m[1].padStart(2, '0');
  const mes = MESES_ES[m[2].toLowerCase()];
  if (!mes) return null;
  return `${m[3]}-${mes}-${dia}`;
}

/** Fecha Valor del HTML oficial: atributo content=… o texto en español. */
export function parseFechaValorBcv(html: string): string | null {
  const zona = /Fecha\s*Valor\s*:[\s\S]{0,700}/i.exec(html)?.[0] ?? html;
  const iso = /content=["'](\d{4}-\d{2}-\d{2})(?:T[^"']*)?["']/i.exec(zona);
  if (iso) return iso[1];
  const isoPlain = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(zona);
  if (isoPlain && /Fecha\s*Valor/i.test(zona)) return isoPlain[1];
  return parseFechaEspanolBcv(zona);
}

function extraerBloqueDolar(html: string): string | null {
  const open = /<div[^>]*\bid=["']dolar["'][^>]*>/i.exec(html);
  if (!open || open.index == null) return null;
  const after = html.slice(open.index + open[0].length);
  const next = after.search(/<div[^>]*\bid=["'][a-z0-9_-]+["']/i);
  return after.slice(0, next === -1 ? 2500 : next);
}

export function parseUsdDesdeBloqueDolar(html: string): number | null {
  const block = extraerBloqueDolar(html);
  if (!block) return null;
  const strong = /<strong[^>]*>\s*([\d.,\s]+)\s*<\/strong>/i.exec(block);
  if (strong) {
    const n = parseNumeroTasaVe(strong[1]);
    if (n) return n;
  }
  const any = /([\d]{2,4}[.,]\d{2,8})/.exec(block);
  return any ? parseNumeroTasaVe(any[1]) : null;
}

export function parseBcvHomepageHtml(html: string): ParseoBcvOficial | null {
  const usd = parseUsdDesdeBloqueDolar(html);
  if (usd == null) return null;
  return {
    usd,
    fechaValor: parseFechaValorBcv(html),
    fuente: FUENTE_BCV_OFICIAL,
  };
}

/**
 * Día en que se guarda la tasa: la Fecha Valor oficial, no «hoy» del scrape.
 * Así un HTML del 4 nov no se registra como tasa del 6.
 */
export function fechaAlmacenamientoTasaBcv(opts: {
  fechaValor: string | null | undefined;
  hoy: string;
}): string {
  const fv = opts.fechaValor?.trim().slice(0, 10) ?? '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(fv)) return fv;
  return opts.hoy;
}

export function estadoTasaParaFechaSolicitada(
  fechaSolicitada: string,
  fechaDeLaTasa: string | null | undefined,
): 'actualizada' | 'desactualizada' {
  const s = fechaSolicitada.trim().slice(0, 10);
  const t = fechaDeLaTasa?.trim().slice(0, 10) ?? '';
  return t && t === s ? 'actualizada' : 'desactualizada';
}

