/**
 * Conciliación de contratos por subcontratista (Control de Obra V4).
 *
 * Acordado  = Σ monto_base_usd de contratos
 * Ejecutado = acordado × pct_avance/100 (avance del operador; no se deriva de pagos)
 * Pagado    = Σ pagos vinculados (no ANULADO) con estado PAGADO/REGISTRADO
 */

import type { CcoProveedorContratos } from '@/lib/contabilidad/cco/types';

export type CcoConciliacionFila = {
  proveedor: string;
  /** Contratos hijos (para expandir). */
  contratos: {
    id: string;
    descripcion: string;
    acordado: number;
    ejecutado: number;
    pagado: number;
    pctAvance: number;
  }[];
  montoAcordado: number;
  montoEjecutado: number;
  montoPagado: number;
  montoPorEjecutar: number;
  montoNoEjecutadoPagado: number;
  montoPagadoDeMas: number;
  totalAnticipado: number;
  ejecutadoSinPagar: number;
  montoNoEjecutadoPorPagar: number;
  avancePct: number;
  estado: 'Terminado' | 'En Ejecución';
};

export type CcoConciliacionResumen = {
  montoAcordado: number;
  montoEjecutado: number;
  montoPagado: number;
  montoPorEjecutar: number;
  montoNoEjecutadoPagado: number;
  montoPagadoDeMas: number;
  totalAnticipado: number;
  ejecutadoSinPagar: number;
  montoNoEjecutadoPorPagar: number;
  avancePct: number;
  estado: 'Terminado' | 'En Ejecución';
};

/** Sugerido a pagar desde el saco según avance del operador. */
export function sugeridoPagarPorAvance(
  costoTotalUsd: number,
  pctAvance: number,
  montoPagadoUsd: number,
): number {
  const pct = Math.min(100, Math.max(0, Number(pctAvance) || 0));
  const meta = round2((Math.max(0, costoTotalUsd) * pct) / 100);
  return Math.max(0, round2(meta - Math.max(0, montoPagadoUsd)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function metricas(acordado: number, ejecutadoRaw: number, pagadoRaw: number) {
  const acordadoN = Math.max(0, acordado);
  const ejecutado = Math.max(0, Math.min(ejecutadoRaw, acordadoN > 0 ? acordadoN : ejecutadoRaw));
  const pagado = Math.max(0, pagadoRaw);

  const montoPorEjecutar = Math.max(0, acordadoN - ejecutado);
  const ejecutadoSinPagar = Math.max(0, ejecutado - pagado);
  const excesoPago = Math.max(0, pagado - ejecutado);
  const montoNoEjecutadoPagado = Math.min(excesoPago, montoPorEjecutar);
  const montoPagadoDeMas = Math.max(0, pagado - acordadoN);
  const totalAnticipado = montoNoEjecutadoPagado + montoPagadoDeMas;
  const montoNoEjecutadoPorPagar = Math.max(0, montoPorEjecutar - montoNoEjecutadoPagado);
  const avancePct =
    acordadoN > 0 ? Math.min(100, Math.round((ejecutado / acordadoN) * 1000) / 10) : 0;
  const estado: 'Terminado' | 'En Ejecución' =
    avancePct >= 99.5 && ejecutadoSinPagar < 0.01 ? 'Terminado' : 'En Ejecución';

  return {
    montoAcordado: round2(acordadoN),
    montoEjecutado: round2(ejecutado),
    montoPagado: round2(pagado),
    montoPorEjecutar: round2(montoPorEjecutar),
    montoNoEjecutadoPagado: round2(montoNoEjecutadoPagado),
    montoPagadoDeMas: round2(montoPagadoDeMas),
    totalAnticipado: round2(totalAnticipado),
    ejecutadoSinPagar: round2(ejecutadoSinPagar),
    montoNoEjecutadoPorPagar: round2(montoNoEjecutadoPorPagar),
    avancePct,
    estado,
  };
}

/** Agrega conciliación V4 por subcontratista a partir de la jerarquía existente. */
export function conciliarContratosPorProveedor(
  porProveedor: CcoProveedorContratos[],
): { filas: CcoConciliacionFila[]; total: CcoConciliacionResumen } {
  const filas: CcoConciliacionFila[] = porProveedor.map((p) => {
    const contratos = p.contratos.map((c) => {
      const acordado = c.monto_base_usd > 0 ? c.monto_base_usd : c.costo_total_usd;
      const pctAvance = Math.min(100, Math.max(0, Number(c.pct_avance) || 0));
      // Ejecutado = avance del operador × acordado (no suma de pagos).
      const ejecutado = round2((acordado * pctAvance) / 100);
      let pagado = 0;
      for (const pago of c.pagos) {
        const est = String(pago.estado ?? 'PAGADO').toUpperCase();
        if (est === 'ANULADO') continue;
        if (est === 'PAGADO' || est === '' || est === 'REGISTRADO' || est === 'PARCIAL') {
          pagado += pago.monto_usd;
        }
      }
      if (c.pagos.length > 0 && pagado === 0 && c.monto_pagado_usd > 0) {
        // Fallback: jerarquía sin estado usable → pagado = total vinculado
        pagado = c.monto_pagado_usd;
      } else if (c.pagos.length === 0) {
        pagado = 0;
      }
      return {
        id: c.id,
        descripcion: c.descripcion,
        acordado,
        ejecutado,
        pagado: round2(pagado),
        pctAvance,
      };
    });

    const acordado = contratos.reduce((s, c) => s + c.acordado, 0);
    const ejecutado = contratos.reduce((s, c) => s + c.ejecutado, 0);
    const pagado = contratos.reduce((s, c) => s + c.pagado, 0);
    const m = metricas(acordado, ejecutado, pagado);

    return {
      proveedor: p.proveedor,
      contratos,
      ...m,
    };
  });

  filas.sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es'));

  const totalAcordado = filas.reduce((s, f) => s + f.montoAcordado, 0);
  const totalEjecutado = filas.reduce((s, f) => s + f.montoEjecutado, 0);
  const totalPagado = filas.reduce((s, f) => s + f.montoPagado, 0);
  // Totales de columnas derivadas: suma de filas (como V4), no recalcular sobre agregados
  const total: CcoConciliacionResumen = {
    montoAcordado: round2(totalAcordado),
    montoEjecutado: round2(totalEjecutado),
    montoPagado: round2(totalPagado),
    montoPorEjecutar: round2(filas.reduce((s, f) => s + f.montoPorEjecutar, 0)),
    montoNoEjecutadoPagado: round2(filas.reduce((s, f) => s + f.montoNoEjecutadoPagado, 0)),
    montoPagadoDeMas: round2(filas.reduce((s, f) => s + f.montoPagadoDeMas, 0)),
    totalAnticipado: round2(filas.reduce((s, f) => s + f.totalAnticipado, 0)),
    ejecutadoSinPagar: round2(filas.reduce((s, f) => s + f.ejecutadoSinPagar, 0)),
    montoNoEjecutadoPorPagar: round2(filas.reduce((s, f) => s + f.montoNoEjecutadoPorPagar, 0)),
    avancePct:
      totalAcordado > 0
        ? Math.min(100, Math.round((totalEjecutado / totalAcordado) * 1000) / 10)
        : 0,
    estado:
      totalAcordado > 0 &&
      totalEjecutado / totalAcordado >= 0.995 &&
      filas.every((f) => f.ejecutadoSinPagar < 0.01)
        ? 'Terminado'
        : 'En Ejecución',
  };

  return { filas, total };
}
