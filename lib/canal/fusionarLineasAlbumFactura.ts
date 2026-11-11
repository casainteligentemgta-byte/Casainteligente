export type LineaAlbumFactura = {
  description: string;
  item_code: string;
  unit: string;
  quantity: number;
  unit_price: number;
};

function normDesc(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Clave de solape: mismo código o misma descripción + cantidad + precio. */
export function claveLineaAlbum(item: LineaAlbumFactura): string {
  const code = String(item.item_code ?? '').trim().toLowerCase();
  const desc = normDesc(item.description);
  const qty = roundMoney(item.quantity);
  const price = roundMoney(item.unit_price);
  if (code) return `c:${code}|q:${qty}|p:${price}`;
  return `d:${desc}|q:${qty}|p:${price}`;
}

/** Quita líneas repetidas por el recorte solapado de fotos consecutivas. Conserva el orden. */
export function fusionarLineasAlbum<T extends LineaAlbumFactura>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const desc = String(it.description ?? '').trim();
    if (!desc) continue;
    const k = claveLineaAlbum({
      description: desc,
      item_code: String(it.item_code ?? ''),
      unit: String(it.unit ?? 'UND'),
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
    });
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

const IVA_VE = 1.16;

export type CuadreAlbumFactura = {
  ok: boolean;
  sumaLineas: number;
  total: number | null;
  motivo?: 'sin_total' | 'descuadre';
};

/**
 * La suma de líneas debe acercarse al total (con o sin IVA 16 %).
 * Tolerancia: 3 % del total o 2 Bs, la que sea mayor.
 */
export function totalesAlbumCuadran(params: {
  items: Array<{ quantity: number; unit_price: number }>;
  total: number | null | undefined;
  toleranciaPct?: number;
  toleranciaAbs?: number;
}): CuadreAlbumFactura {
  const sumaLineas = roundMoney(
    params.items.reduce(
      (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0,
    ),
  );
  const totalRaw = params.total == null ? null : Number(params.total);
  const total = totalRaw != null && Number.isFinite(totalRaw) ? totalRaw : null;
  if (total == null || total <= 0) {
    return { ok: false, sumaLineas, total, motivo: 'sin_total' };
  }
  const abs = params.toleranciaAbs ?? 2;
  const pct = params.toleranciaPct ?? 0.03;
  const tol = Math.max(abs, Math.abs(total) * pct);
  const candidatos = [sumaLineas, roundMoney(sumaLineas * IVA_VE), roundMoney(sumaLineas / IVA_VE)];
  if (candidatos.some((c) => Math.abs(c - total) <= tol)) {
    return { ok: true, sumaLineas, total };
  }
  return { ok: false, sumaLineas, total, motivo: 'descuadre' };
}
