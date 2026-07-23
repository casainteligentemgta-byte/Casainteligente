/**
 * Tipos de cómputos métricos (tabla Supabase `computos_metricos`).
 */

export type UnidadMedidaComputo = 'm2' | 'm3' | 'ml' | 'kg' | 'und';

export const UNIDADES_MEDIDA_COMPUTO: UnidadMedidaComputo[] = ['m2', 'm3', 'ml', 'kg', 'und'];

export interface ComputoMetrico {
  id: number;
  gasto_id: number | null;
  capitulo: string;
  subcapitulo: string | null;
  partida_codigo: string | null;
  descripcion_elemento: string;
  ubicacion: string | null;
  cantidad: number;
  largo: number;
  ancho: number;
  alto_profundidad: number;
  unidad_medida: string;
  formula_expresion: string | null;
  total_computado: number;
  soporte_url: string | null;
  observaciones: string | null;
  created_at: string;
}

/** Payload de alta / edición (campos opcionales salvo los mínimos de negocio). */
export type ComputoMetricoInput = Partial<
  Omit<ComputoMetrico, 'id' | 'created_at'>
> & {
  descripcion_elemento?: string;
  capitulo?: string;
};

/**
 * Calcula total y expresión según unidad.
 * - m2 → C × L × A
 * - m3 → C × L × A × H
 * - ml → C × L
 * - kg / und → C
 * - otro → producto de factores > 0 (vacíos se tratan como 1)
 */
export function calcularTotalComputado(opts: {
  unidad_medida: string;
  cantidad: number;
  largo: number;
  ancho: number;
  alto_profundidad: number;
}): { total: number; formula: string } {
  const c = Number(opts.cantidad) || 0;
  const l = Number(opts.largo) || 0;
  const a = Number(opts.ancho) || 0;
  const h = Number(opts.alto_profundidad) || 0;
  const u = String(opts.unidad_medida || '').trim().toLowerCase();

  const round = (n: number) => Math.round(n * 1e6) / 1e6;

  if (u === 'm2') {
    const total = round(c * l * a);
    return { total, formula: `${c} × ${l} × ${a}` };
  }
  if (u === 'm3') {
    const total = round(c * l * a * h);
    return { total, formula: `${c} × ${l} × ${a} × ${h}` };
  }
  if (u === 'ml') {
    const total = round(c * l);
    return { total, formula: `${c} × ${l}` };
  }
  if (u === 'kg' || u === 'und') {
    return { total: round(c), formula: String(c) };
  }

  const factors = [c, l, a, h].map((n) => (n > 0 ? n : 1));
  const total = round(factors.reduce((acc, n) => acc * n, 1));
  return {
    total,
    formula: factors.join(' × '),
  };
}
