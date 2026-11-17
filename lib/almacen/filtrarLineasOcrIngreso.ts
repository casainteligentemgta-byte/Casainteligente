/** Filtra y normaliza líneas OCR de facturas/notas para el ingreso por Telegram. */

export type CantidadOcrParte = {
  cantidad: number;
  unidad: string;
  etiqueta: string;
};

export type ItemOcrCrudo = {
  description?: string | null;
  item_code?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  quantity_present?: boolean | null;
  quantity_raw?: string | null;
  quantity_parts?: Array<{
    quantity?: number | null;
    unit?: string | null;
    label?: string | null;
  } | null> | null;
};

export type LineaOcrConCantidad = {
  description: string;
  item_code: string;
  unidad: string;
  cantidad: number;
  cantidades: CantidadOcrParte[];
  quantity_raw: string;
};

const ENCABEZADO_UNIDAD = /^(cantidad|cant\.?|und\.?|unidad(es)?|u\.?m\.?|descripci[oó]n|art[ií]culo|material|concepto|detalle|item)$/i;

const ALIAS_UNIDAD: Record<string, string> = {
  pallet: 'PALLET',
  pallets: 'PALLET',
  palet: 'PALLET',
  palets: 'PALLET',
  paleta: 'PALLET',
  paletas: 'PALLET',
  saco: 'SACO',
  sacos: 'SACO',
  sac: 'SAC',
  m3: 'M3',
  'm³': 'M3',
  und: 'UND',
  unidad: 'UND',
  unidades: 'UND',
  kg: 'KG',
  l: 'L',
  gl: 'GL',
  m2: 'M2',
  m: 'M',
};

/** Encabezado de columna (CANTIDAD, UNIDAD, …), no una unidad de la celda. */
export function esUnidadEncabezadoColumna(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return true;
  return ENCABEZADO_UNIDAD.test(t);
}

export function normalizarUnidadOcr(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim();
  if (!t || esUnidadEncabezadoColumna(t)) return '';
  const alias = ALIAS_UNIDAD[t.toLowerCase()];
  if (alias) return alias;
  return t.toUpperCase().slice(0, 32);
}

function numeroCantidad(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return null;
  const t = raw.trim().replace(/\s/g, '');
  if (!t) return null;
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (!den) return null;
    const n = Number(frac[1]) / den;
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number(t.includes(',') && t.includes('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Lee cantidades compuestas manuscritas: «4 pallet y 1/2 saco», «4 pallet + 0,5 saco».
 */
export function parsearCantidadesCompuestas(raw: string | null | undefined): CantidadOcrParte[] {
  const text = String(raw ?? '').trim();
  if (!text) return [];

  const partes: CantidadOcrParte[] = [];
  const re = /(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)\s*([a-záéíóúüñ°³]+)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const cantidad = numeroCantidad(m[1].replace(/\s/g, ''));
    if (cantidad == null) continue;
    const unidad = normalizarUnidadOcr(m[2] ?? '');
    const etiqueta = `${m[1].replace(/\s/g, '')}${m[2] ? ` ${m[2].trim()}` : ''}`.trim();
    partes.push({ cantidad, unidad, etiqueta });
  }
  return partes;
}

function partesDesdeItem(item: ItemOcrCrudo): CantidadOcrParte[] {
  const fromSchema = (item.quantity_parts ?? [])
    .map((p) => {
      if (!p) return null;
      const cantidad = numeroCantidad(p.quantity);
      if (cantidad == null) return null;
      const unidad = normalizarUnidadOcr(p.unit ?? '');
      const etiqueta = String(p.label ?? '').trim() || `${cantidad}${unidad ? ` ${unidad}` : ''}`;
      return { cantidad, unidad, etiqueta };
    })
    .filter((p): p is CantidadOcrParte => p != null);
  if (fromSchema.length) return fromSchema;

  const fromRaw = parsearCantidadesCompuestas(item.quantity_raw ?? '');
  if (fromRaw.length) return fromRaw;

  const q = numeroCantidad(item.quantity);
  if (q == null) return [];
  const unidad = normalizarUnidadOcr(item.unit ?? '');
  return [{ cantidad: q, unidad, etiqueta: `${q}${unidad ? ` ${unidad}` : ''}` }];
}

export function lineaOcrTieneCantidadLeida(item: ItemOcrCrudo): boolean {
  if (item.quantity_present === false) return false;
  return partesDesdeItem(item).length > 0;
}

/**
 * Descarta renglones sin cantidad leída (no inventa cantidad=1)
 * y no usa como unidad un encabezado de columna vacío.
 */
export function filtrarLineasOcrConCantidad(items: Array<ItemOcrCrudo | null | undefined>): LineaOcrConCantidad[] {
  const out: LineaOcrConCantidad[] = [];
  for (const raw of items) {
    if (!raw) continue;
    const description = String(raw.description ?? '').trim();
    if (!description) continue;
    if (!lineaOcrTieneCantidadLeida(raw)) continue;
    const cantidades = partesDesdeItem(raw);
    if (!cantidades.length) continue;
    const principal = cantidades[0];
    const unidadCelda = normalizarUnidadOcr(raw.unit ?? '');
    out.push({
      description,
      item_code: String(raw.item_code ?? '').trim(),
      unidad: principal.unidad || unidadCelda || 'UND',
      cantidad: principal.cantidad,
      cantidades,
      quantity_raw: String(raw.quantity_raw ?? '').trim(),
    });
  }
  return out;
}

/** Renglones típicos de nota preimpresa 2M Venezuela (arena…otros). */
export const RENGLONES_FORMULARIO_2M = [
  'ARENA',
  'ARROCILLO',
  'PIEDRA',
  'POLVILLO',
  'RELLENO',
  'TEJAS',
  'BLOQUES',
  'TABELONES',
  'PLACAS',
  'AGUA',
  'CEMENTO',
  'FLETES',
  'OTROS',
] as const;
