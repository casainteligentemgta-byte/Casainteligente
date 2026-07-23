/**
 * Dashboard CCO alimentado por `registros_gastos` (histórico RANCHO).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CCO_TIPOS_GASTO,
  CCO_TIPO_COLOR_PIE,
  clasificarTipoGasto,
  type CcoTipoGasto,
} from '@/lib/contabilidad/ccoClasificarGasto';
import { aplicarFactorDevaluacion } from '@/lib/contabilidad/cco/tasas';
import { applyDerivedCsvMontos, round2HalfUp } from '@/lib/contabilidad/cco/parseCsvMaestro';
import { getGastosCCO } from '@/lib/contabilidad/cco/registrosGastos';
import type {
  CcoCapituloFila,
  CcoCapituloJerarquia,
  CcoDashboard,
  CcoGastoMensual,
  CcoHijoJerarquia,
  CcoKpiBloque,
  CcoProveedorFila,
  CcoProyectoOpcion,
  CcoSeriePunto,
  CcoSubCapituloStack,
  CcoTipoPie,
  CcoTreemapNodo,
} from '@/lib/contabilidad/cargarCcoDashboard';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ym(fecha: string | null | undefined): string | null {
  const s = String(fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s.slice(0, 7);
}

function aplicarDevaluacion(oficial: CcoKpiBloque, devalPct: number): CcoKpiBloque {
  return {
    ingresos: aplicarFactorDevaluacion(oficial.ingresos, devalPct),
    gastosNetos: aplicarFactorDevaluacion(oficial.gastosNetos, devalPct),
    adminDelegada: aplicarFactorDevaluacion(oficial.adminDelegada, devalPct),
    costoTotal: aplicarFactorDevaluacion(oficial.costoTotal, devalPct),
    saldoCaja: aplicarFactorDevaluacion(oficial.saldoCaja, devalPct),
    countIngresos: oficial.countIngresos,
    countGastos: oficial.countGastos,
  };
}

function acumularSerie(
  porMesIngresos: Map<string, number>,
  porMesEgresos: Map<string, number>,
): { periodo: CcoSeriePunto[]; acumulado: CcoSeriePunto[]; gastos: CcoGastoMensual[] } {
  const keys = new Set([
    ...Array.from(porMesIngresos.keys()),
    ...Array.from(porMesEgresos.keys()),
  ]);
  const periodos = Array.from(keys).sort();
  const periodo: CcoSeriePunto[] = [];
  const acumulado: CcoSeriePunto[] = [];
  const gastos: CcoGastoMensual[] = [];
  let ai = 0;
  let ae = 0;
  for (const p of periodos) {
    const ingresos = porMesIngresos.get(p) ?? 0;
    const egresos = porMesEgresos.get(p) ?? 0;
    periodo.push({ periodo: p, ingresos, egresos, saldo: ingresos - egresos });
    ai += ingresos;
    ae += egresos;
    acumulado.push({ periodo: p, ingresos: ai, egresos: ae, saldo: ai - ae });
    gastos.push({ periodo: p, costo: egresos });
  }
  return { periodo, acumulado, gastos };
}

export async function cargarDashboardDesdeRegistrosGastos(
  supabase: SupabaseClient,
  params: {
    proyectoId: string | null;
    proyectoNombre: string;
    proyectos: CcoProyectoOpcion[];
    honorariosPct: number;
    devaluacionPromedio: number;
    /** Si true, no reemplazar devaluacion con promedio de filas. */
    forzarDevaluacionManual?: boolean;
  },
): Promise<CcoDashboard> {
  const { rows, total } = await getGastosCCO(supabase, {
    limit: 50_000,
    proyectoId: params.proyectoId,
  });

  const porMesIngresos = new Map<string, number>();
  const porMesEgresos = new Map<string, number>();
  const porProveedor = new Map<string, number>();
  const porCapTipo = new Map<string, Map<CcoTipoGasto, number>>();
  const porTipoTotal = new Map<CcoTipoGasto, number>();

  let ingresos = 0;
  let gastosNetos = 0;
  let honorariosSum = 0;
  let costoTotalSum = 0;
  let countIngresos = 0;
  let countGastos = 0;
  let sumBrecha = 0;
  let nBrecha = 0;

  for (const r of rows) {
    const clase = String(r.clase ?? '').toUpperCase();
    const periodo = ym(r.fecha);
    const derived = applyDerivedCsvMontos(
      {
        clase,
        moneda: r.moneda,
        monto_orig: r.monto_orig,
        monto_base_usd: r.monto_base_usd,
        honorarios: r.honorarios,
        costo_total: r.costo_total,
        porcentaje_admin: r.porcentaje_admin,
        tasa: r.tasa,
      },
      params.honorariosPct,
    );
    const base = num(derived.monto_base_usd);
    const hon = num(derived.honorarios);
    const costo = num(derived.costo_total) || base + hon;

    if (r.porcentaje_brecha_real != null && Number.isFinite(Number(r.porcentaje_brecha_real))) {
      sumBrecha += Number(r.porcentaje_brecha_real);
      nBrecha += 1;
    }

    if (clase === 'INGRESO') {
      ingresos += base || costo;
      countIngresos += 1;
      if (periodo) {
        porMesIngresos.set(periodo, (porMesIngresos.get(periodo) ?? 0) + (base || costo));
      }
      continue;
    }

    if (clase === 'CONTRATO' || clase === 'PRESUPUESTO' || clase === 'PRESUPUESTO_METADATA' || clase === 'AUDITORIA') {
      continue;
    }

    // GASTO y demás → egreso
    countGastos += 1;
    gastosNetos += base;
    honorariosSum += hon;
    costoTotalSum += costo;
    if (periodo) porMesEgresos.set(periodo, (porMesEgresos.get(periodo) ?? 0) + base);

    const prov = r.proveedor?.trim() || 'Sin proveedor';
    porProveedor.set(prov, (porProveedor.get(prov) ?? 0) + base);

    const cap = (r.capitulo?.trim() || 'SIN CAPÍTULO').slice(0, 28).toUpperCase();
    const tipoPersistido = String(r.tipo ?? '').trim().toUpperCase();
    const tipo = (CCO_TIPOS_GASTO as readonly string[]).includes(tipoPersistido)
      ? (tipoPersistido as CcoTipoGasto)
      : clasificarTipoGasto(prov);
    if (!porCapTipo.has(cap)) porCapTipo.set(cap, new Map());
    const m = porCapTipo.get(cap)!;
    m.set(tipo, (m.get(tipo) ?? 0) + base);
    porTipoTotal.set(tipo, (porTipoTotal.get(tipo) ?? 0) + base);
  }

  const brechaFilas = nBrecha > 0 ? Math.round((sumBrecha / nBrecha) * 10000) / 10000 : null;
  let devaluacionPromedio = params.devaluacionPromedio;
  let brechaFuente: CcoDashboard['brechaFuente'] = 'config';
  if (params.forzarDevaluacionManual) {
    brechaFuente = 'manual';
  } else if (brechaFilas != null) {
    devaluacionPromedio = brechaFilas;
    brechaFuente = 'filas_registros_gastos';
  }

  const adminDelegada = honorariosSum;
  const costoTotal = costoTotalSum;
  const saldoCaja = round2HalfUp(ingresos - costoTotal);

  const totalGastos = gastosNetos || 1;
  for (const [, tipos] of Array.from(porCapTipo.entries())) {
    const matCap = Array.from(tipos.values()).reduce((a, b) => a + b, 0);
    const adminShare = adminDelegada * (matCap / totalGastos);
    if (adminShare > 0) {
      tipos.set(
        'ADMINISTRACIÓN DELEGADA',
        (tipos.get('ADMINISTRACIÓN DELEGADA') ?? 0) + adminShare,
      );
      porTipoTotal.set(
        'ADMINISTRACIÓN DELEGADA',
        (porTipoTotal.get('ADMINISTRACIÓN DELEGADA') ?? 0) + adminShare,
      );
    }
  }

  const grandTotal =
    Array.from(porCapTipo.values()).reduce(
      (acc, tipos) => acc + Array.from(tipos.values()).reduce((a, b) => a + b, 0),
      0,
    ) || 1;

  const oficial: CcoKpiBloque = {
    ingresos: Math.round(ingresos * 100) / 100,
    gastosNetos: Math.round(gastosNetos * 100) / 100,
    adminDelegada: Math.round(adminDelegada * 100) / 100,
    costoTotal: Math.round(costoTotal * 100) / 100,
    saldoCaja: Math.round(saldoCaja * 100) / 100,
    countIngresos,
    countGastos,
  };

  const { periodo: flujoPeriodo, acumulado: flujoAcumulado, gastos: gastosMensual } =
    acumularSerie(porMesIngresos, porMesEgresos);

  const topProveedores: CcoProveedorFila[] = Array.from(porProveedor.entries())
    .map(([proveedor, costo]) => ({ proveedor, costo }))
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 10)
    .reverse();

  type CcoCapituloMontoKey = Exclude<keyof CcoCapituloFila, 'cap'>;
  const tipKey = (t: CcoTipoGasto): CcoCapituloMontoKey => {
    const map: Record<CcoTipoGasto, CcoCapituloMontoKey> = {
      'ADMINISTRACIÓN DELEGADA': 'admin',
      MATERIALES: 'materiales',
      CONTRATISTA: 'contratista',
      EQUIPOS: 'equipos',
      INSUMOS: 'insumos',
      'MANO DE OBRA': 'mano',
      TRANSPORTE: 'transporte',
      PERMISOLOGIA: 'permiso',
      PROYECTO: 'proyecto',
    };
    return map[t];
  };

  const capitulos: CcoCapituloFila[] = Array.from(porCapTipo.entries())
    .map(([cap, tipos]) => {
      const row: CcoCapituloFila = {
        cap: cap.slice(0, 22),
        admin: 0,
        materiales: 0,
        contratista: 0,
        equipos: 0,
        insumos: 0,
        mano: 0,
        transporte: 0,
        permiso: 0,
        proyecto: 0,
      };
      for (const [t, v] of Array.from(tipos.entries())) {
        row[tipKey(t)] = v;
      }
      return row;
    })
    .sort((a, b) => {
      const ta = a.admin + a.materiales + a.contratista + a.equipos + a.insumos + a.mano;
      const tb = b.admin + b.materiales + b.contratista + b.equipos + b.insumos + b.mano;
      return tb - ta;
    })
    .slice(0, 12);

  const jerarquiaCapitulos: CcoCapituloJerarquia[] = Array.from(porCapTipo.entries())
    .map(([nombre, tipos]) => {
      const totalCap = Array.from(tipos.values()).reduce((a, b) => a + b, 0);
      const hijos: CcoHijoJerarquia[] = Array.from(tipos.entries())
        .filter(([, c]) => c > 0)
        .map(([n, costo]) => ({
          nombre: n,
          costo,
          pctPadre: totalCap > 0 ? (costo / totalCap) * 100 : 0,
          pctTotal: (costo / grandTotal) * 100,
        }))
        .sort((a, b) => b.costo - a.costo);
      return {
        nombre,
        total: totalCap,
        pctTotal: (totalCap / grandTotal) * 100,
        hijos,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const subCapitulosStack: CcoSubCapituloStack[] = jerarquiaCapitulos.map((c) => {
    const row: CcoSubCapituloStack = { sub: c.nombre.slice(0, 18) };
    for (const t of CCO_TIPOS_GASTO) {
      row[t] = porCapTipo.get(c.nombre)?.get(t) ?? 0;
    }
    return row;
  });

  const tiposPie: CcoTipoPie[] = CCO_TIPOS_GASTO.map((name) => ({
    name,
    value: porTipoTotal.get(name) ?? 0,
    color: CCO_TIPO_COLOR_PIE[name],
  }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);

  const treemapNodos: CcoTreemapNodo[] = [];
  for (const cap of jerarquiaCapitulos) {
    for (const h of cap.hijos) {
      treemapNodos.push({
        cap: cap.nombre,
        sub: h.nombre,
        costo: h.costo,
        pctPadre: h.pctPadre,
        pctTotal: h.pctTotal,
      });
    }
  }

  return {
    proyectoId: params.proyectoId,
    proyectoNombre: params.proyectoNombre,
    totalRegistros: total,
    honorariosPct: params.honorariosPct,
    devaluacionPromedio,
    brechaFuente,
    oficial,
    real: aplicarDevaluacion(oficial, devaluacionPromedio),
    flujoAcumulado,
    flujoPeriodo,
    gastosMensual,
    topProveedores,
    capitulos,
    jerarquiaCapitulos,
    subCapitulosStack,
    tiposPie,
    treemapNodos,
    proyectos: params.proyectos,
  };
}
