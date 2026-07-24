import type { GastoObra, GastosObraFiltros } from '@/types/gastos-obra';
import { FILTRO_TODOS } from '@/types/gastos-obra';

export function mesFromFecha(fecha: string): string {
  return fecha.slice(0, 7);
}

export function labelMes(ym: string): string {
  const [y, m] = ym.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = Number(m) - 1;
  return `${meses[idx] ?? m} ${y}`;
}

export function aplicaFiltros(data: GastoObra[], filtros: GastosObraFiltros): GastoObra[] {
  return data.filter((row) => {
    if (filtros.mes !== FILTRO_TODOS && mesFromFecha(row.fecha) !== filtros.mes) return false;
    if (filtros.tipo !== FILTRO_TODOS && row.tipo !== filtros.tipo) return false;
    if (filtros.disciplina !== FILTRO_TODOS && row.disciplina !== filtros.disciplina) return false;
    return true;
  });
}

/** Filtros sin mes (para evolución mensual). */
export function aplicaFiltrosSinMes(data: GastoObra[], filtros: GastosObraFiltros): GastoObra[] {
  return aplicaFiltros(data, { ...filtros, mes: FILTRO_TODOS });
}

export function sumCosto(rows: GastoObra[]): number {
  return rows.reduce((acc, r) => acc + Number(r.costo) || 0, 0);
}

export function valoresUnicos(data: GastoObra[], campo: keyof Pick<GastoObra, 'tipo' | 'disciplina'>): string[] {
  return Array.from(new Set(data.map((r) => r[campo]).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
}

export function mesesUnicos(data: GastoObra[]): string[] {
  return Array.from(new Set(data.map((r) => mesFromFecha(r.fecha)))).sort();
}

export function acumuladoHastaMes(data: GastoObra[], mesCorte: string): number {
  return sumCosto(data.filter((r) => mesFromFecha(r.fecha) <= mesCorte));
}

export type EvolucionMes = { mes: string; label: string; costo: number };

export function evolucionPorMes(data: GastoObra[]): EvolucionMes[] {
  const map = new Map<string, number>();
  for (const row of data) {
    const ym = mesFromFecha(row.fecha);
    map.set(ym, (map.get(ym) ?? 0) + Number(row.costo));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, costo]) => ({ mes, label: labelMes(mes), costo }));
}

export type AgrupadoTipo = { tipo: string; costo: number };

export function top10PorTipo(data: GastoObra[]): AgrupadoTipo[] {
  const map = new Map<string, number>();
  for (const row of data) {
    const k = row.tipo || 'Sin tipo';
    map.set(k, (map.get(k) ?? 0) + Number(row.costo));
  }
  return Array.from(map.entries())
    .map(([tipo, costo]) => ({ tipo, costo }))
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 10);
}

export type AgrupadoProveedor = { proveedor: string; costo: number };

export function top10PorProveedor(data: GastoObra[]): AgrupadoProveedor[] {
  const map = new Map<string, number>();
  for (const row of data) {
    const k = row.proveedor?.trim() || 'Sin proveedor';
    map.set(k, (map.get(k) ?? 0) + Number(row.costo));
  }
  return Array.from(map.entries())
    .map(([proveedor, costo]) => ({ proveedor, costo }))
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 10);
}

export type AgrupadoDisciplina = { disciplina: string; costo: number };

export function porDisciplina(data: GastoObra[]): AgrupadoDisciplina[] {
  const map = new Map<string, number>();
  for (const row of data) {
    const k = row.disciplina || 'Sin área';
    map.set(k, (map.get(k) ?? 0) + Number(row.costo));
  }
  return Array.from(map.entries())
    .map(([disciplina, costo]) => ({ disciplina, costo }))
    .sort((a, b) => b.costo - a.costo);
}

export type ProveedorAgrupado = {
  proveedor: string;
  costo: number;
  transacciones: GastoObra[];
};

export function agruparPorProveedor(data: GastoObra[]): ProveedorAgrupado[] {
  const map = new Map<string, GastoObra[]>();
  for (const row of data) {
    const k = row.proveedor?.trim() || 'Sin proveedor';
    const list = map.get(k) ?? [];
    list.push(row);
    map.set(k, list);
  }
  return Array.from(map.entries())
    .map(([proveedor, transacciones]) => ({
      proveedor,
      costo: sumCosto(transacciones),
      transacciones: transacciones.sort((a, b) => b.fecha.localeCompare(a.fecha)),
    }))
    .sort((a, b) => b.costo - a.costo);
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
