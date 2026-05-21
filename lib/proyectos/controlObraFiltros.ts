import { filtrarFilasLulo } from '@/lib/proyectos/luloTablaFiltros';
import { getCapituloKey } from '@/lib/proyectos/luloVistaAgrupada';

export type FiltrosPartidasObra = {
  busqueda: string;
  columna?: string;
  codigo?: string;
  capitulo?: string;
  montoMin?: string;
  montoMax?: string;
};

export type FiltrosGastosObra = {
  busqueda: string;
  columna?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  tipo?: string;
  disciplina?: string;
  proveedor?: string;
  costoMin?: string;
  costoMax?: string;
};

function parseNum(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function filtrarPartidasObra<T extends Record<string, unknown>>(
  rows: T[],
  keys: string[],
  f: FiltrosPartidasObra,
): T[] {
  let out = filtrarFilasLulo(rows, keys, f.busqueda, f.columna || undefined);
  const cod = f.codigo?.trim().toLowerCase();
  if (cod) {
    out = out.filter((r) =>
      String(r.codigo_partida ?? '')
        .toLowerCase()
        .includes(cod),
    );
  }
  const cap = f.capitulo?.trim();
  if (cap) {
    out = out.filter((r) => getCapituloKey(String(r.codigo_partida ?? '')) === cap);
  }
  const min = parseNum(f.montoMin);
  const max = parseNum(f.montoMax);
  if (min != null) {
    out = out.filter((r) => Number(r.monto_total_estimado ?? 0) >= min);
  }
  if (max != null) {
    out = out.filter((r) => Number(r.monto_total_estimado ?? 0) <= max);
  }
  return out;
}

export function filtrarGastosObra<T extends Record<string, unknown>>(
  rows: T[],
  keys: string[],
  f: FiltrosGastosObra,
): T[] {
  let out = filtrarFilasLulo(rows, keys, f.busqueda, f.columna || undefined);
  if (f.fechaDesde) {
    out = out.filter((r) => String(r.fecha ?? '') >= f.fechaDesde!);
  }
  if (f.fechaHasta) {
    out = out.filter((r) => String(r.fecha ?? '') <= f.fechaHasta!);
  }
  const tipo = f.tipo?.trim().toLowerCase();
  if (tipo) out = out.filter((r) => String(r.tipo ?? '').toLowerCase().includes(tipo));
  const disc = f.disciplina?.trim().toLowerCase();
  if (disc) out = out.filter((r) => String(r.disciplina ?? '').toLowerCase().includes(disc));
  const prov = f.proveedor?.trim().toLowerCase();
  if (prov) out = out.filter((r) => String(r.proveedor ?? '').toLowerCase().includes(prov));
  const min = parseNum(f.costoMin);
  const max = parseNum(f.costoMax);
  if (min != null) out = out.filter((r) => Number(r.costo ?? 0) >= min);
  if (max != null) out = out.filter((r) => Number(r.costo ?? 0) <= max);
  return out;
}
