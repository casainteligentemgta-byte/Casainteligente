/**
 * Extrae cantidad + unidad física desde textos de gastos CCO V4 / compras.
 * Ej.: "CONCRETO PREMEZCLADO 12.5 M3", "CEMENTO GRIS 50 SACOS", "CABILLA 3/8 2.5 TN"
 */

export type CantidadParseada = {
  cantidad: number;
  unidad: string;
  /** Fragmento del texto que matcheó. */
  match: string;
  confianza: 'alta' | 'media';
};

const NUM = String.raw`(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?|\d+[.,]\d+|\d+)`;

/** Patrones: número + unidad (orden: más específicos primero). */
const PATTERNS: Array<{ re: RegExp; unidad: string; confianza: 'alta' | 'media' }> = [
  { re: new RegExp(`${NUM}\\s*(?:M[³3]|M3|MTS?3|METROS?\\s*CUBICOS?)\\b`, 'i'), unidad: 'M3', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:M[²2]|M2|MTS?2|METROS?\\s*CUADRADOS?)\\b`, 'i'), unidad: 'M2', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:ML|M\\.L\\.|METROS?\\s*LINEALES?)\\b`, 'i'), unidad: 'ML', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:TN|TON|TONELADAS?)\\b`, 'i'), unidad: 'TN', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:KG|KILOS?|KILOGRAMOS?)\\b`, 'i'), unidad: 'KG', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:SACOS?|SAC)\\b`, 'i'), unidad: 'SACO', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:CABILLAS?|VARILLAS?|VAR)\\b`, 'i'), unidad: 'VAR', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:BLOQUES?|BLK)\\b`, 'i'), unidad: 'BLK', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:UND|UNID(?:ADES?)?|U\\.?|PZAS?|PIEZAS?)\\b`, 'i'), unidad: 'UND', confianza: 'media' },
  { re: new RegExp(`${NUM}\\s*(?:VIAJES?)\\b`, 'i'), unidad: 'VIA', confianza: 'alta' },
  { re: new RegExp(`${NUM}\\s*(?:LTS?|LITROS?)\\b`, 'i'), unidad: 'LT', confianza: 'alta' },
  /** "ATADO DE 3/8 (300 CABILLAS)" — cantidad entre paréntesis + unidad. */
  {
    re: new RegExp(`\\(\\s*${NUM}\\s*(?:CABILLAS?|VARILLAS?|SACOS?|M[³3]|M3)\\s*\\)`, 'i'),
    unidad: 'PAREN',
    confianza: 'alta',
  },
];

/** Porcentaje de avance de contrato — no es cantidad física. */
const PCT_AVANCE = /\(\s*\d{1,3}(?:[.,]\d+)?\s*%\s*\)/;

function parseNumeroEs(raw: string): number | null {
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  // 1.234,56 → 1234.56 | 1,234.56 → 1234.56 | 12,5 → 12.5 | 12.5 → 12.5
  if (/\d\.\d{3},\d+$/.test(s) || /^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\d,\d{3}\.\d+$/.test(s) || /^\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/^\d+,\d+$/.test(s)) {
    s = s.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // miles sin decimales: 22.561 → 22561
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ConceptoMaterial =
  | 'concreto_premezclado'
  | 'cemento'
  | 'acero_cabillas'
  | 'otro';

const CONCEPTOS: Array<{ id: ConceptoMaterial; re: RegExp }> = [
  {
    id: 'concreto_premezclado',
    re: /premezclad|concreto\s*premez|hormigon\s*premez|ready[\s-]?mix|\bconcreto\b|\bhormigon\b/i,
  },
  {
    id: 'acero_cabillas',
    re: /\bcabillas?\b|\bfierro\b|\brebar\b|\bvarillas?\b|(?:\bacero\b(?!\s*inoxid))/i,
  },
  {
    id: 'cemento',
    re: /\bcementos?\b|\bcem\.?\s*gris\b|\bcem\.?\s*portland\b/i,
  },
];

export function clasificarConceptoMaterial(texto: string): ConceptoMaterial {
  const t = String(texto ?? '');
  // Bloques de cemento ≠ sacos de cemento.
  if (/bloques?\s+de\s+cemento/i.test(t) && !/\bsacos?\b/i.test(t)) {
    return 'otro';
  }
  // Clavos / ferretería con "acero" no son cabillas estructurales.
  if (/clavos?\s+de\s+acero/i.test(t) && !/cabill|varilla|fierro/i.test(t)) {
    return 'otro';
  }
  // "concreto" genérico solo si parece volumen / premezclado (no "bloque de concreto" ornamental).
  if (/\bconcreto\b|\bhormigon\b/i.test(t) && !/premezclad|ready[\s-]?mix/i.test(t)) {
    if (!/\b(M\s*[³3]|M3|BOMBA|PREMEZ|MTS?\s*3)\b/i.test(t) && !/\d+[.,]?\d*\s*M/i.test(t)) {
      // deja que otros conceptos (cemento) puedan matchear; si no, otro
      for (const c of CONCEPTOS) {
        if (c.id === 'concreto_premezclado') continue;
        if (c.re.test(t)) return c.id;
      }
      return 'otro';
    }
  }
  for (const c of CONCEPTOS) {
    if (c.re.test(t)) return c.id;
  }
  return 'otro';
}

export function etiquetaConceptoMaterial(id: ConceptoMaterial): string {
  switch (id) {
    case 'concreto_premezclado':
      return 'Concreto Premezclado';
    case 'cemento':
      return 'Cemento (sacos)';
    case 'acero_cabillas':
      return 'Acero y cabillas';
    default:
      return 'Otro';
  }
}

/** Unidad canónica esperada al comparar con la matriz / consolidado. */
export function unidadCanonicaConcepto(id: ConceptoMaterial): string | null {
  switch (id) {
    case 'concreto_premezclado':
      return 'M3';
    case 'cemento':
      return 'SACO';
    case 'acero_cabillas':
      return 'VAR';
    default:
      return null;
  }
}

/** Normaliza descripción quitando %(avance) para deduplicar splits V4. */
export function claveDescSinPct(texto: string): string {
  return String(texto ?? '')
    .replace(PCT_AVANCE, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Intenta inferir cantidad física. Ignora “(48%)” de avance de contrato.
 * Si hay varios matches, prioriza unidades de obra (M3/SACO/TN/…) sobre UND.
 */
export function parseCantidadDesdeDescripcion(
  texto: string | null | undefined,
): CantidadParseada | null {
  const raw = String(texto ?? '').trim();
  if (!raw) return null;

  // Quitar % avance para no confundir "50%" con cantidad.
  const limpio = raw.replace(PCT_AVANCE, ' ');

  const candidatos: CantidadParseada[] = [];
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : `${p.re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(limpio)) != null) {
      const cantidad = parseNumeroEs(m[1]);
      if (cantidad == null) continue;
      // Evitar fracciones de calibre tipo "3/8" pegadas al número.
      const before = limpio.slice(Math.max(0, m.index - 2), m.index);
      const after = limpio.slice(m.index + m[0].length, m.index + m[0].length + 2);
      if (/\/\s*$/.test(before) || /^\s*\//.test(after)) continue;

      let unidad = p.unidad;
      if (unidad === 'PAREN') {
        const frag = m[0].toUpperCase();
        if (/CABILL|VARILL/.test(frag)) unidad = 'VAR';
        else if (/SACO/.test(frag)) unidad = 'SACO';
        else if (/M[³3]|M3/.test(frag)) unidad = 'M3';
        else continue;
      }

      candidatos.push({
        cantidad,
        unidad,
        match: m[0].trim(),
        confianza: p.confianza,
      });
    }
  }

  if (!candidatos.length) return null;

  const peso = (u: string) => {
    if (u === 'M3' || u === 'SACO' || u === 'TN' || u === 'KG' || u === 'VAR') return 3;
    if (u === 'M2' || u === 'ML' || u === 'VIA' || u === 'LT' || u === 'BLK') return 2;
    return 1;
  };

  candidatos.sort((a, b) => {
    const pw = peso(b.unidad) - peso(a.unidad);
    if (pw !== 0) return pw;
    if (a.confianza !== b.confianza) return a.confianza === 'alta' ? -1 : 1;
    return b.cantidad - a.cantidad;
  });

  return candidatos[0];
}

/** True si la línea parece el stub del import V4 (1 UND = monto completo). */
export function esLineaStubV4(opts: {
  cantidad: number;
  unidad: string | null | undefined;
  origen?: string | null;
}): boolean {
  const cant = Number(opts.cantidad) || 0;
  const und = String(opts.unidad ?? 'UND').trim().toUpperCase();
  const origen = String(opts.origen ?? '');
  if (cant !== 1) return false;
  if (und !== 'UND' && und !== 'UNID' && und !== 'U') return false;
  if (origen && origen !== 'cco_v4_import') return false;
  return true;
}
