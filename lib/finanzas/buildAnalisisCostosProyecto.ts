import { CalculadoraLiquidacionConstruccion } from '@/lib/construccion/liquidacion/CalculadoraLiquidacionConstruccion';
import type { LiquidacionConstruccionInput } from '@/lib/construccion/liquidacion/types';
import { calcularCompensacionDiaria } from '@/lib/nomina/compensacionDiaria';

export type EmpleadoObraAnalisis = {
  empleadoId: string;
  nombre: string;
  cargoCodigo: string | null;
  cargoNombre: string | null;
  nivel: number;
  salarioBasicoDiarioVES: number;
  /** SB diario + bono asistencia prorrateado (Conv. 2023; bono Cl. 41). Referencia “nómina” según tabulador. */
  remuneracionDiariaConvencionVES: number;
  diasLaboradosReferencia: number;
  totalAcumuladoMesVES: number;
  liquidacionProyectadaFinMesVES: number | null;
  liquidacionError?: string;
};

export type ObraFinanzasSnapshot = {
  id: string;
  nombre: string;
  presupuestoManoObraVES: number;
  fondoReservaLiquidacionVES: number | null;
  presupuestoVesFallback: number | null;
};

function clampNivel(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 1;
  return Math.min(9, Math.max(1, Math.round(n)));
}

function toDateISO(d: string | null | undefined): string | null {
  if (!d) return null;
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  return t.toISOString().slice(0, 10);
}

/** Último día del mes `YYYY-MM`. */
export function ultimoDiaMesISO(añoMes: string): string {
  const [y, m] = añoMes.split('-').map((x) => Number(x));
  if (!y || !m || m < 1 || m > 12) return `${añoMes}-28`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${añoMes}-${String(last).padStart(2, '0')}`;
}

export function primerDiaMesISO(añoMes: string): string {
  return `${añoMes}-01`;
}

/**
 * Arma filas de análisis: costo mensual por remuneración convencional y liquidación simulada (cierre de obra a fin de mes).
 */
export function buildAnalisisCostosProyecto(args: {
  obra: {
    id: string;
    nombre: string;
    presupuesto_mano_obra_ves?: number | null;
    presupuesto_ves?: number | null;
    fondo_reserva_liquidacion_ves?: number | null;
  };
  empleados: Array<{
    id: string;
    nombre_completo: string;
    cargo_codigo?: string | null;
    cargo_nombre?: string | null;
    cargo_nivel?: number | null;
    created_at?: string | null;
  }>;
  añoMes: string;
  diasLaboradosMesReferencia: number;
}): {
  obra: ObraFinanzasSnapshot;
  filas: EmpleadoObraAnalisis[];
  costoRealMesVES: number;
  liquidacionProyectadaTotalVES: number;
  presupuestoManoObraReferenciaVES: number;
  desviacionManoObraVES: number;
  desviacionManoObraPct: number | null;
} {
  const dias = Math.max(1, Math.min(31, Math.floor(args.diasLaboradosMesReferencia)));
  const finMes = ultimoDiaMesISO(args.añoMes);
  const inicioMes = primerDiaMesISO(args.añoMes);

  const presupuestoMano =
    args.obra.presupuesto_mano_obra_ves != null && Number(args.obra.presupuesto_mano_obra_ves) > 0
      ? Number(args.obra.presupuesto_mano_obra_ves)
      : args.obra.presupuesto_ves != null && Number(args.obra.presupuesto_ves) > 0
        ? Number(args.obra.presupuesto_ves)
        : 0;

  const fondoRes =
    args.obra.fondo_reserva_liquidacion_ves != null && Number.isFinite(Number(args.obra.fondo_reserva_liquidacion_ves))
      ? Number(args.obra.fondo_reserva_liquidacion_ves)
      : null;

  const filas: EmpleadoObraAnalisis[] = [];
  let costoRealMes = 0;
  let liqTotal = 0;

  for (const e of args.empleados) {
    const nivel = clampNivel(e.cargo_nivel);
    const comp = calcularCompensacionDiaria(nivel);
    const remDiaria = comp.totalDiarioVES;
    const totalMes = Math.round(remDiaria * dias * 100) / 100;
    costoRealMes += totalMes;

    const creado = toDateISO(e.created_at ?? null);
    /** Antigüedad hasta fin de mes: ingreso = alta del empleado o, si falta, inicio del mes analizado. */
    const ingresoISO = creado && creado <= finMes ? creado : inicioMes;
    let liquidacionProyectada: number | null = null;
    let liquidacionError: string | undefined;
    if (creado && creado > finMes) {
      liquidacionError = 'fecha_alta_posterior_al_periodo';
    } else {
      try {
        const input: LiquidacionConstruccionInput = {
          fechaIngreso: ingresoISO,
          fechaEgreso: finMes,
          nivelSalario: nivel,
          ultimoSalarioBasicoDiarioVES: 0,
          motivoRetiro: 'cierre_obra',
        };
        const res = CalculadoraLiquidacionConstruccion.calcular(input);
        liquidacionProyectada = res.granTotalVES;
        liqTotal += liquidacionProyectada;
      } catch (err) {
        liquidacionError = err instanceof Error ? err.message : 'liquidación_no_calculada';
      }
    }

    filas.push({
      empleadoId: e.id,
      nombre: e.nombre_completo,
      cargoCodigo: e.cargo_codigo ?? null,
      cargoNombre: e.cargo_nombre ?? null,
      nivel,
      salarioBasicoDiarioVES: comp.salarioBasicoDiarioVES,
      remuneracionDiariaConvencionVES: remDiaria,
      diasLaboradosReferencia: dias,
      totalAcumuladoMesVES: totalMes,
      liquidacionProyectadaFinMesVES: liquidacionProyectada,
      liquidacionError,
    });
  }

  const desviacion = Math.round((costoRealMes - presupuestoMano) * 100) / 100;
  const desviacionPct =
    presupuestoMano > 0 ? Math.round((desviacion / presupuestoMano) * 10_000) / 100 : null;

  return {
    obra: {
      id: args.obra.id,
      nombre: args.obra.nombre,
      presupuestoManoObraVES: presupuestoMano,
      fondoReservaLiquidacionVES: fondoRes,
      presupuestoVesFallback:
        args.obra.presupuesto_mano_obra_ves == null || Number(args.obra.presupuesto_mano_obra_ves) <= 0
          ? args.obra.presupuesto_ves != null
            ? Number(args.obra.presupuesto_ves)
            : null
          : null,
    },
    filas,
    costoRealMesVES: Math.round(costoRealMes * 100) / 100,
    liquidacionProyectadaTotalVES: Math.round(liqTotal * 100) / 100,
    presupuestoManoObraReferenciaVES: presupuestoMano,
    desviacionManoObraVES: desviacion,
    desviacionManoObraPct: desviacionPct,
  };
}
