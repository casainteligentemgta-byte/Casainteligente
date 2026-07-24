/**
 * Consolida métricas de utilidad real a partir de filas ya leídas de Supabase (ci_proyectos unificado + tablas satélite).
 * Sin I/O: facilita tests y reutilización desde hooks o API.
 */

export type ProyectoFinSnapshot = {
  id: string;
  tipo_proyecto?: string | null;
  monto_aproximado?: number | null;
  moneda?: string | null;
  obra_precio_venta_usd?: number | null;
  obra_presupuesto_ves?: number | null;
  obra_presupuesto_mano_obra_ves?: number | null;
  created_at?: string | null;
  obra_fecha_inicio?: string | null;
  obra_fecha_entrega?: string | null;
};

const MS_DIA = 86_400_000;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Tasa BCV referencial VES→USD cuando solo hay montos en bolívares. */
export function ingresosContratoUsd(p: ProyectoFinSnapshot, tasaBcvUsdPorVes: number): number {
  const tasa = tasaBcvUsdPorVes > 0 ? tasaBcvUsdPorVes : 1;
  const tipo = (p.tipo_proyecto ?? 'integral').toLowerCase();
  const precioUsd = Number(p.obra_precio_venta_usd ?? 0);
  if (tipo === 'talento') {
    if (precioUsd > 0) return precioUsd;
    const ves = Number(p.obra_presupuesto_ves ?? 0);
    if (ves > 0) return ves / tasa;
  }
  const m = Number(p.monto_aproximado ?? 0);
  const mon = (p.moneda ?? 'USD').toUpperCase();
  if (mon === 'VES' && m > 0) return m / tasa;
  return m;
}

export function diasEntre(inicio: Date, fin: Date): number {
  return Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / MS_DIA));
}

export function semanasEntre(inicio: Date, fin: Date): number {
  return Math.max(1, Math.ceil(diasEntre(inicio, fin) / 7));
}

export function fechaReferenciaFinObra(p: ProyectoFinSnapshot): Date {
  const raw = p.obra_fecha_entrega ?? p.obra_fecha_inicio ?? null;
  if (raw) {
    const d = new Date(String(raw));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const c = p.created_at ? new Date(p.created_at) : new Date();
  if (Number.isNaN(c.getTime())) return new Date();
  return new Date(c.getTime() + 120 * MS_DIA);
}

export function seriePresupuestoVsGasto(args: {
  ingresosUsd: number;
  gastoRealAcumuladoUsd: number;
  inicio: Date;
  finObra: Date;
  ahora: Date;
  puntos?: number;
}): Array<{ label: string; presupuestoAcum: number; gastoAcum: number; ahorro: number }> {
  const steps = clamp(Math.floor(args.puntos ?? 11), 5, 24);
  const dTot = Math.max(1, diasEntre(args.inicio, args.finObra));
  const dEl = Math.max(1, diasEntre(args.inicio, args.ahora));
  const pAt = clamp(dEl / dTot, 0.05, 1);
  const ritmoDiario = args.gastoRealAcumuladoUsd / dEl;
  const gastoProyectadoFin = ritmoDiario * dTot;
  const out: Array<{ label: string; presupuestoAcum: number; gastoAcum: number; ahorro: number }> = [];
  const tSpan = Math.max(args.finObra.getTime() - args.inicio.getTime(), MS_DIA * 14);

  for (let i = 0; i <= steps; i += 1) {
    const p = i / steps;
    const t = new Date(args.inicio.getTime() + p * tSpan);
    const label = t.toLocaleDateString('es-VE', { month: 'short', day: 'numeric' });
    const presupuestoAcum = args.ingresosUsd * p;
    let gastoAcum: number;
    if (p <= pAt) {
      gastoAcum = args.gastoRealAcumuladoUsd * (p / pAt);
    } else {
      const u = (p - pAt) / Math.max(0.001, 1 - pAt);
      gastoAcum = args.gastoRealAcumuladoUsd + (gastoProyectadoFin - args.gastoRealAcumuladoUsd) * u;
    }
    gastoAcum = Math.max(0, gastoAcum);
    out.push({
      label,
      presupuestoAcum,
      gastoAcum,
      ahorro: presupuestoAcum - gastoAcum,
    });
  }
  const last = out[out.length - 1];
  if (last) {
    last.gastoAcum = args.gastoRealAcumuladoUsd;
    last.ahorro = last.presupuestoAcum - last.gastoAcum;
  }
  return out;
}

export function burnRateTalentoUsd(nominaAcumUsd: number, inicio: Date, ahora: Date): number {
  const sem = semanasEntre(inicio, ahora);
  return nominaAcumUsd / sem;
}

export function proyectarUtilidadFinObraUsd(args: {
  ingresosUsd: number;
  gastoAcumUsd: number;
  inicio: Date;
  finObra: Date;
  ahora: Date;
}): number {
  const dTot = Math.max(1, diasEntre(args.inicio, args.finObra));
  const dEl = Math.max(1, diasEntre(args.inicio, args.ahora));
  const ritmo = args.gastoAcumUsd / dEl;
  const gastoProyectadoFin = ritmo * dTot;
  return args.ingresosUsd - gastoProyectadoFin;
}

export function margenBrutoPct(ingresos: number, gastos: number): number | null {
  if (!ingresos || ingresos <= 0) return null;
  return ((ingresos - gastos) / ingresos) * 100;
}

/** Heurística beneficios IVSS / alimentación hasta existan partidas contables. */
export function beneficiosEstimadosUsd(nominaUsd: number, tasaBeneficios: number): number {
  const t = tasaBeneficios >= 0 && tasaBeneficios < 1 ? tasaBeneficios : 0.12;
  return nominaUsd * t;
}
