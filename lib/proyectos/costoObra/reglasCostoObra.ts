/**
 * Reglas del centro de costo por obra. Deben coincidir con
 * `supabase/migrations/389_ci_costo_obra.sql` (`ci_costo_obra`).
 */

import { honorariosAdminPctODefault } from '@/lib/contabilidad/cco/honorarios';
import { round2 } from '@/lib/proyectos/jornales/calcularJornalesSemana';
import { costoEgresoLineaUsd } from '@/lib/proyectos/desviacion/montoAUsd';
import {
  REGLA_MANO_OBRA_COSTO,
  type CostoObraFuenteManoObra,
  type CostoObraPayload,
  type EgresoAlmacenCosto,
  type JornalFila,
  type NominaPagadaFila,
} from '@/lib/proyectos/costoObra/tipos';

export { REGLA_MANO_OBRA_COSTO, MIGRACION_COSTO_OBRA } from '@/lib/proyectos/costoObra/tipos';

export function esObraDemo(nombre: string | null | undefined): boolean {
  const n = String(nombre ?? '');
  return /\[DEMO\]/i.test(n) || /^DEMO-/i.test(n.trim());
}

export function esMigracionCostoObraPendiente(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase();
  if (!m) return false;
  return (
    (m.includes('ci_costo_obra') ||
      m.includes('costo_diario') ||
      m.includes('fecha_devolucion') ||
      m.includes('ci_v_costo_obra')) &&
    (m.includes('does not exist') ||
      m.includes('schema cache') ||
      m.includes('could not find') ||
      m.includes('pgrst202') ||
      m.includes('42883'))
  );
}

function isoDate(raw: string | null | undefined): string {
  return String(raw ?? '').slice(0, 10);
}

function fechaEnRango(fecha: string, desde: string, hasta: string): boolean {
  const f = isoDate(fecha);
  return f >= isoDate(desde) && f <= isoDate(hasta);
}

/**
 * Nómina pagada gana sobre jornales para el mismo empleado y semana.
 * Los jornales de un empleado fuera de semanas pagadas sí se suman.
 */
export function combinarManoObraUsd(
  nominaPagada: NominaPagadaFila[],
  jornales: JornalFila[],
): { nominaUsd: number; jornalesUsd: number; totalUsd: number; fuente: CostoObraFuenteManoObra } {
  const nominaUsd = round2(
    nominaPagada.reduce((s, n) => s + Math.max(0, Number(n.total_usd) || 0), 0),
  );
  const jornalesUsd = round2(
    jornales.reduce((s, j) => {
      const cubierto = nominaPagada.some(
        (n) =>
          String(n.empleado_id) === String(j.empleado_id) &&
          fechaEnRango(j.fecha, n.semana_inicio, n.semana_fin),
      );
      if (cubierto) return s;
      return s + Math.max(0, Number(j.costo_jornal) || 0);
    }, 0),
  );
  let fuente: CostoObraFuenteManoObra = 'ninguna';
  if (nominaUsd > 0 && jornalesUsd > 0) fuente = 'mixto';
  else if (nominaUsd > 0) fuente = 'nomina';
  else if (jornalesUsd > 0) fuente = 'jornales';
  return { nominaUsd, jornalesUsd, totalUsd: round2(nominaUsd + jornalesUsd), fuente };
}

/**
 * Compras de la obra + solo egresos cuyo origen NO es el almacén de esta obra.
 */
export function materialesSinDobleConteoUsd(args: {
  comprasUsd: number;
  egresos: EgresoAlmacenCosto[];
  proyectoId: string;
}): { comprasUsd: number; egresosAjenosUsd: number; totalUsd: number } {
  const comprasUsd = round2(Math.max(0, Number(args.comprasUsd) || 0));
  const egresosAjenosUsd = round2(
    args.egresos.reduce((s, e) => {
      const origen = e.origen_proyecto_id ? String(e.origen_proyecto_id) : '';
      if (origen && origen === String(args.proyectoId)) return s;
      return (
        s +
        costoEgresoLineaUsd({
          cantidad: e.cantidad,
          averageWeightedCost: e.average_weighted_cost,
          lastPurchasePrice: e.last_purchase_price,
        })
      );
    }, 0),
  );
  return { comprasUsd, egresosAjenosUsd, totalUsd: round2(comprasUsd + egresosAjenosUsd) };
}

export function diasAsignacionHerramienta(args: {
  fechaAsignacion?: string | null;
  fechaArriendoInicio?: string | null;
  fechaDevolucion?: string | null;
  fechaArriendoFin?: string | null;
  createdAt?: string | null;
  hoy?: string;
}): number {
  const hoy = isoDate(args.hoy) || new Date().toISOString().slice(0, 10);
  const desde =
    isoDate(args.fechaAsignacion) ||
    isoDate(args.fechaArriendoInicio) ||
    isoDate(args.createdAt) ||
    hoy;
  const finArriendo = isoDate(args.fechaArriendoFin);
  const hastaRaw = isoDate(args.fechaDevolucion) || (finArriendo && finArriendo < hoy ? finArriendo : hoy);
  const hasta = hastaRaw || hoy;
  const ms = Date.parse(hasta) - Date.parse(desde);
  if (!Number.isFinite(ms)) return 1;
  const dias = Math.floor(ms / 86_400_000) + 1;
  return Math.max(1, dias);
}

export function costoHerramientaUsd(args: {
  costoDiario?: number | null;
  costoArriendo?: number | null;
  monedaArriendo?: string | null;
  cantidad?: number | null;
  dias: number;
  tasaBcv?: number;
}): number {
  const dias = Math.max(1, Number(args.dias) || 1);
  const cant = Number(args.cantidad);
  const cantidad = Number.isFinite(cant) && cant > 0 ? cant : 1;
  const diario = Number(args.costoDiario);
  if (Number.isFinite(diario) && diario > 0) {
    return round2(diario * dias * cantidad);
  }
  const arriendo = Number(args.costoArriendo);
  if (!Number.isFinite(arriendo) || arriendo <= 0) return 0;
  const mon = String(args.monedaArriendo ?? 'USD').trim().toUpperCase();
  if (mon === 'USD') return round2(arriendo);
  const tasa = Number(args.tasaBcv);
  if (!Number.isFinite(tasa) || tasa <= 0) return 0;
  return round2(arriendo / tasa);
}

export function honorariosAdDeCostoDirecto(args: {
  costoDirectoUsd: number;
  honorariosAdminPct?: number | null;
  hayFilaConfig: boolean;
}): { pct: number; usd: number; fuente: string } {
  const pct = args.hayFilaConfig
    ? honorariosAdminPctODefault(args.honorariosAdminPct, 15)
    : 15;
  const base = Math.max(0, Number(args.costoDirectoUsd) || 0);
  const usd = pct > 0 && base > 0 ? round2(base * (pct / 100)) : 0;
  return {
    pct,
    usd,
    fuente: args.hayFilaConfig ? 'cco_proyecto_config' : 'default',
  };
}

export function payloadCostoObraVacio(args: {
  proyectoId: string;
  proyectoNombre: string;
  excluidoDemo?: boolean;
}): CostoObraPayload {
  const vacioPartida = { usd: 0, detalle: [] as CostoObraPayload['partidas']['herramientas']['detalle'] };
  return {
    proyecto_id: args.proyectoId,
    proyecto_nombre: args.proyectoNombre,
    excluido_demo: Boolean(args.excluidoDemo),
    regla_mano_obra: REGLA_MANO_OBRA_COSTO,
    tasa_bcv_ves_por_usd: 0,
    partidas: {
      materiales: { usd: 0, compras_usd: 0, egresos_ajenos_usd: 0, detalle: [] },
      mano_obra: { usd: 0, fuente: 'ninguna', nomina_usd: 0, jornales_usd: 0, detalle: [] },
      herramientas: vacioPartida,
      otros: { usd: 0, gastos_obra_usd: 0, registros_gastos_usd: 0, detalle: [] },
    },
    honorarios_ad: { pct: args.excluidoDemo ? 0 : 15, usd: 0, fuente: args.excluidoDemo ? 'excluido_demo' : 'default' },
    total_directo_usd: 0,
    total_con_honorarios_ad_usd: 0,
  };
}

export function etiquetaFuenteManoObra(fuente: CostoObraFuenteManoObra): string {
  switch (fuente) {
    case 'nomina':
      return 'Nómina pagada';
    case 'jornales':
      return 'Jornales (no había nómina pagada)';
    case 'mixto':
      return 'Nómina pagada + jornales de quien no estaba en nómina';
    default:
      return 'Sin mano de obra registrada';
  }
}
