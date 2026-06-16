export type InventarioExportScope = 'filtrado' | 'completo';

export type InventarioFilaExport = {
  codigo: string;
  material: string;
  unidad: string;
  entidad: string;
  obra: string;
  partida: string;
  ubicacion: string;
  stock: number;
  costoPromedio: number;
  valorStock: number;
  ultimaCompraFecha: string;
  ultimaCompraPrecio: number;
  categoria: string;
};

export type InventarioShareState = {
  q?: string;
  cat?: string;
  entidad?: string;
  proyecto?: string;
  partida?: string;
  deposito?: string;
  /** operacional | administrativo | servicio | sin_clasificar */
  gastoEntidad?: string;
  sinObra?: boolean;
  sinAlmacen?: boolean;
  kpi?: string;
};

const SHARE_KEYS = [
  'q',
  'cat',
  'entidad',
  'proyecto',
  'partida',
  'deposito',
  'gastoEntidad',
  'sinObra',
  'sinAlmacen',
  'kpi',
] as const;

const CSV_HEADERS = [
  'Código',
  'Material',
  'Unidad',
  'Entidad',
  'Obra / Proyecto',
  'Partida Lulo',
  'Ubicación',
  'Stock',
  'Costo promedio USD',
  'Valor stock USD',
  'Última compra',
  'Precio última compra USD',
  'Categoría',
] as const;

function setShareParam(qs: URLSearchParams, key: string, value: string | boolean | undefined | null) {
  if (typeof value === 'boolean') {
    if (value) qs.set(key, '1');
    return;
  }
  const v = String(value ?? '').trim();
  if (v) qs.set(key, v);
}

export function hasInventarioShareParams(params: URLSearchParams): boolean {
  return SHARE_KEYS.some((k) => params.has(k));
}

export function parseInventarioShareParams(params: URLSearchParams): InventarioShareState {
  return {
    q: params.get('q')?.trim() || undefined,
    cat: params.get('cat')?.trim() || undefined,
    entidad: params.get('entidad')?.trim() || undefined,
    proyecto: params.get('proyecto')?.trim() || undefined,
    partida: params.get('partida')?.trim() || undefined,
    deposito: params.get('deposito')?.trim() || undefined,
    gastoEntidad: params.get('gastoEntidad')?.trim() || undefined,
    sinObra: params.get('sinObra') === '1',
    sinAlmacen: params.get('sinAlmacen') === '1',
    kpi: params.get('kpi')?.trim() || undefined,
  };
}

export function buildInventarioShareUrl(origin: string, state: InventarioShareState): string {
  const qs = buildInventarioShareSearchParams(state);
  const query = qs.toString();
  return query ? `${origin}/almacen?${query}` : `${origin}/almacen`;
}

export function buildInventarioShareSearchParams(state: InventarioShareState): URLSearchParams {
  const qs = new URLSearchParams();
  setShareParam(qs, 'q', state.q);
  setShareParam(qs, 'cat', state.cat);
  setShareParam(qs, 'entidad', state.entidad);
  setShareParam(qs, 'proyecto', state.proyecto);
  setShareParam(qs, 'partida', state.partida);
  setShareParam(qs, 'deposito', state.deposito);
  setShareParam(qs, 'gastoEntidad', state.gastoEntidad);
  setShareParam(qs, 'sinObra', state.sinObra);
  setShareParam(qs, 'sinAlmacen', state.sinAlmacen);
  setShareParam(qs, 'kpi', state.kpi);
  return qs;
}

export function inventarioCuadroPathFromState(state: InventarioShareState): string {
  const query = buildInventarioShareSearchParams(state).toString();
  return query ? `/almacen?${query}` : '/almacen';
}

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function filaExportACeldas(f: InventarioFilaExport): string[] {
  return [
    f.codigo,
    f.material,
    f.unidad,
    f.entidad,
    f.obra,
    f.partida,
    f.ubicacion,
    String(f.stock),
    f.costoPromedio.toFixed(2),
    f.valorStock.toFixed(2),
    f.ultimaCompraFecha,
    f.ultimaCompraPrecio > 0 ? f.ultimaCompraPrecio.toFixed(2) : '',
    f.categoria,
  ];
}

export function inventarioFilasACsv(filas: InventarioFilaExport[]): string {
  const lines = [
    CSV_HEADERS.join(','),
    ...filas.map((f) => filaExportACeldas(f).map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function inventarioFilasATsv(filas: InventarioFilaExport[]): string {
  const lines = [
    CSV_HEADERS.join('\t'),
    ...filas.map((f) => filaExportACeldas(f).join('\t')),
  ];
  return lines.join('\r\n');
}

export function inventarioFilasATextoResumen(
  filas: InventarioFilaExport[],
  opts: {
    titulo: string;
    scopeLabel: string;
    totalValor: number;
    url?: string;
    maxLineas?: number;
  },
): string {
  const max = opts.maxLineas ?? 80;
  const muestra = filas.slice(0, max);
  const lineas = muestra.map(
    (f) =>
      `- ${f.material} (${f.codigo || 'S/C'}): ${f.stock} ${f.unidad} · ${f.ubicacion || '—'} · ${f.obra || '—'}`,
  );
  const partes = [
    opts.titulo,
    opts.scopeLabel,
    `${filas.length} material(es) · Valor USD ${opts.totalValor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  ];
  if (opts.url) partes.push(opts.url);
  if (lineas.length) partes.push('', ...lineas);
  if (filas.length > max) {
    partes.push('', `… y ${filas.length - max} material(es) más (exporte CSV para la lista completa).`);
  }
  return partes.join('\n');
}

export function descargarTextoComoArchivo(
  content: string,
  filename: string,
  mimeType = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copiarTextoInventario(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function nombreArchivoInventarioCsv(scope: InventarioExportScope): string {
  const fecha = new Date().toISOString().slice(0, 10);
  return scope === 'filtrado'
    ? `inventario-almacen-filtrado-${fecha}.csv`
    : `inventario-almacen-completo-${fecha}.csv`;
}
