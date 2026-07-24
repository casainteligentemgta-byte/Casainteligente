/**
 * Detecta gastos gemelos / duplicados CCO, incluyendo egresos agrupados
 * (mismo criterio que «Agrupar Gastos Divididos» en el cuadro de egresos).
 */
import {
  baseDescripcionSinPct,
  claveGastoDividido,
  parsePctDistribucion,
} from '@/lib/contabilidad/cco/egresosVista';

export type GastoGemeloLike = {
  id: string;
  fecha?: string | null;
  proveedor?: string | null;
  supplier_name?: string | null;
  descripcion?: string | null;
  notas?: string | null;
  monto_usd?: number | null;
  monto_base_usd?: number | null;
  invoice_number?: string | null;
  split_group_key?: string | null;
  origen_v4_id?: number | string | null;
  created_at?: string | null;
  purchase_invoice_id?: string | null;
  display_id?: string | number | null;
};

/** Par de gastos gemelos: el que se conserva vs el duplicado a quitar. */
export type GastoGemeloPar = {
  conservarId: string;
  eliminarId: string;
  /** Todos los ids de la unidad a conservar (1 o N si agrupado). */
  conservarIds: string[];
  /** Todos los ids de la unidad gemela a quitar. */
  eliminarIds: string[];
  fecha: string;
  proveedor: string;
  monto_usd: number;
  concepto: string;
  invoice_key: string;
  /** Campos de negocio que coinciden entre ambos. */
  coinciden: string[];
  conservarResumen: string;
  eliminarResumen: string;
  /** True si el gemelo es un egreso dividido (varias partes). */
  esAgrupado: boolean;
  partesConservar: number;
  partesEliminar: number;
};

type UnidadGasto = {
  ids: string[];
  rows: GastoGemeloLike[];
  head: GastoGemeloLike;
  fecha: string;
  proveedor: string;
  monto_usd: number;
  concepto: string;
  invoice_key: string;
  clave: string;
  esAgrupado: boolean;
  score: number;
  createdAt: string;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normTexto(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function proveedorDe(r: GastoGemeloLike): string {
  return (
    String(r.proveedor ?? '').trim() ||
    String(r.supplier_name ?? '').trim() ||
    'Sin proveedor'
  );
}

function descripcionDe(r: GastoGemeloLike): string {
  return String(r.descripcion ?? r.notas ?? '').trim();
}

function montoDe(r: GastoGemeloLike): number {
  const m = r.monto_base_usd != null ? num(r.monto_base_usd) : num(r.monto_usd);
  return Math.round(m * 100) / 100;
}

function conceptoBase(r: GastoGemeloLike): string {
  return normTexto(baseDescripcionSinPct(descripcionDe(r)))
    .replace(/^CCO-V4-\d+\s*/, '')
    .slice(0, 80);
}

function invoiceKeyDe(r: GastoGemeloLike): string {
  const inv = String(r.invoice_number ?? '').trim().toUpperCase();
  if (inv.startsWith('CCO-V4-')) return inv;
  return '';
}

function scoreUnidad(rows: GastoGemeloLike[]): number {
  let s = 0;
  for (const r of rows) {
    if (r.origen_v4_id != null && String(r.origen_v4_id).trim() !== '') s += 10;
    if (String(r.invoice_number ?? '').toUpperCase().startsWith('CCO-V4-')) s += 5;
    if (r.purchase_invoice_id) s += 100; // no borrar procurement
  }
  return s;
}

function createdAtMin(rows: GastoGemeloLike[]): string {
  return rows
    .map((r) => String(r.created_at ?? ''))
    .filter(Boolean)
    .sort()[0] ?? '';
}

function fingerprintPartes(rows: GastoGemeloLike[]): string {
  return rows
    .map((r) => {
      const pct = parsePctDistribucion(descripcionDe(r));
      const pctKey = pct != null ? String(Math.round(pct * 10) / 10) : '';
      return `${conceptoBase(r)}@${pctKey}@${montoDe(r).toFixed(2)}`;
    })
    .sort()
    .join(';');
}

function camposQueCoinciden(clave: string, esAgrupado: boolean): string[] {
  // clave = fecha|prov|monto|concepto|inv|agrupado?
  const parts = clave.split('|');
  const out: string[] = [];
  if (parts[0]) out.push('fecha');
  if (parts[1]) out.push('proveedor');
  if (parts[2] != null && parts[2] !== '') out.push('monto');
  if (parts[3]) out.push(esAgrupado ? 'concepto (egreso agrupado)' : 'concepto');
  if (parts[4]) out.push('factura CCO-V4');
  if (esAgrupado) out.push('distribución / partes');
  return out.length ? out : ['fecha', 'proveedor', 'monto', 'concepto'];
}

function resumenUnidad(u: UnidadGasto): string {
  const inv = String(u.head.invoice_number ?? '').trim();
  const id = String(u.head.id ?? '').slice(0, 8);
  const invPart = inv ? ` · ${inv.slice(0, 24)}` : '';
  const agrup =
    u.esAgrupado ? ` · agrupado ${u.ids.length} partes` : '';
  const concepto =
    u.concepto && u.concepto !== '(SIN CONCEPTO)'
      ? ` · ${u.concepto.slice(0, 40)}`
      : '';
  return `${u.fecha || 'sin fecha'} · ${u.proveedor} · $${u.monto_usd.toFixed(2)}${concepto}${agrup}${invPart} (#${id})`;
}

function splitKeyDe(r: GastoGemeloLike): string | null {
  if (r.split_group_key) return r.split_group_key;
  return claveGastoDividido({
    invoice_number: r.invoice_number,
    fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
    proveedor: proveedorDe(r),
    descripcion: descripcionDe(r),
  });
}

function unidadDesdeFilas(rows: GastoGemeloLike[], esAgrupado: boolean): UnidadGasto | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) =>
    String(b.display_id ?? b.id).localeCompare(String(a.display_id ?? a.id), undefined, {
      numeric: true,
    }),
  );
  const head = sorted[0]!;
  const monto_usd =
    Math.round(rows.reduce((s, r) => s + montoDe(r), 0) * 100) / 100;
  if (monto_usd <= 0) return null;

  const fecha = String(head.fecha ?? '').slice(0, 10);
  const proveedor = proveedorDe(head);
  const concepto = esAgrupado
    ? fingerprintPartes(rows) || conceptoBase(head) || '(SIN CONCEPTO)'
    : conceptoBase(head) || '(SIN CONCEPTO)';
  const invoice_key = esAgrupado ? '' : invoiceKeyDe(head);
  const clave = [
    fecha,
    normTexto(proveedor),
    String(monto_usd),
    concepto.slice(0, 200),
    invoice_key,
    esAgrupado ? 'AGR' : 'UNI',
  ].join('|');

  return {
    ids: rows.map((r) => String(r.id)),
    rows,
    head,
    fecha,
    proveedor,
    monto_usd,
    concepto: esAgrupado
      ? baseDescripcionSinPct(descripcionDe(head)).slice(0, 80) ||
        `(${rows.length} partes)`
      : baseDescripcionSinPct(descripcionDe(head)).slice(0, 80) || '(sin concepto)',
    invoice_key,
    clave,
    esAgrupado,
    score: scoreUnidad(rows),
    createdAt: createdAtMin(rows),
  };
}

/**
 * Arma unidades de gasto: filas sueltas + grupos de egresos divididos
 * (misma lógica visual que Agrupar Gastos Divididos).
 */
export function armarUnidadesGasto(rows: GastoGemeloLike[]): UnidadGasto[] {
  const groups = new Map<string, GastoGemeloLike[]>();
  const singles: GastoGemeloLike[] = [];

  for (const r of rows) {
    const sk = splitKeyDe(r);
    if (!sk) {
      singles.push(r);
      continue;
    }
    const list = groups.get(sk) ?? [];
    list.push(r);
    groups.set(sk, list);
  }

  const unidades: UnidadGasto[] = [];
  for (const r of singles) {
    const u = unidadDesdeFilas([r], false);
    if (u) unidades.push(u);
  }
  for (const parts of Array.from(groups.values())) {
    if (parts.length < 2) {
      const u = unidadDesdeFilas(parts, false);
      if (u) unidades.push(u);
      continue;
    }
    const u = unidadDesdeFilas(parts, true);
    if (u) unidades.push(u);
  }
  return unidades;
}

/**
 * Detecta pares gemelos entre unidades (fila suelta o egreso agrupado).
 * No marca como eliminable una unidad con purchase_invoice_id.
 */
export function detectarParesGastosGemelos(rows: GastoGemeloLike[]): GastoGemeloPar[] {
  const unidades = armarUnidadesGasto(rows);
  const byClave = new Map<string, UnidadGasto[]>();
  for (const u of unidades) {
    if (!byClave.has(u.clave)) byClave.set(u.clave, []);
    byClave.get(u.clave)!.push(u);
  }

  const pares: GastoGemeloPar[] = [];
  for (const [clave, group] of Array.from(byClave.entries())) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.createdAt.localeCompare(b.createdAt);
    });
    const keep = ranked[0]!;
    const coinciden = camposQueCoinciden(clave, keep.esAgrupado || ranked.some((g) => g.esAgrupado));
    for (const drop of ranked.slice(1)) {
      if (drop.rows.some((r) => r.purchase_invoice_id)) continue;
      pares.push({
        conservarId: keep.ids[0]!,
        eliminarId: drop.ids[0]!,
        conservarIds: keep.ids,
        eliminarIds: drop.ids,
        fecha: keep.fecha,
        proveedor: keep.proveedor,
        monto_usd: keep.monto_usd,
        concepto: keep.concepto,
        invoice_key: keep.invoice_key,
        coinciden,
        conservarResumen: resumenUnidad(keep),
        eliminarResumen: resumenUnidad(drop),
        esAgrupado: keep.esAgrupado || drop.esAgrupado,
        partesConservar: keep.ids.length,
        partesEliminar: drop.ids.length,
      });
    }
  }
  return pares;
}

/**
 * Clave de negocio para resaltar gemelos en la vista (fila o agrupada).
 * Misma idea que el dedupe: fecha + proveedor + monto + concepto base.
 */
export function claveGemeloVista(row: {
  fecha?: string | null;
  proveedor?: string | null;
  descripcion?: string | null;
  monto_base_usd?: number | null;
  monto_usd?: number | null;
  invoice_number?: string | null;
  _agrupada?: boolean;
  split_group_key?: string | null;
  _groupIds?: string[];
}): string {
  const fecha = String(row.fecha ?? '').slice(0, 10);
  const prov = normTexto(String(row.proveedor ?? ''));
  const monto = Math.round(num(row.monto_base_usd ?? row.monto_usd) * 100) / 100;
  const concepto = normTexto(baseDescripcionSinPct(String(row.descripcion ?? ''))).slice(0, 80);
  const inv = String(row.invoice_number ?? '').trim().toUpperCase();
  const invKey = inv.startsWith('CCO-V4-') ? inv : '';
  const agr =
    row._agrupada || (row.split_group_key && (row._groupIds?.length ?? 0) > 1)
      ? 'AGR'
      : 'UNI';
  return `${fecha}|${prov}|${monto}|${concepto}|${invKey}|${agr}`;
}
