import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { TIPO_CONTRATO_AD, ESTADO_CONTRATO_EXITOSO } from '@/lib/proyectos/contratoAdministracionDelegada';
import {
  CCO_TIPOS_GASTO,
  CCO_TIPO_COLOR_PIE,
  clasificarTipoGasto,
  type CcoTipoGasto,
} from '@/lib/contabilidad/ccoClasificarGasto';
import { aplicarFactorDevaluacion } from '@/lib/contabilidad/cco/tasas';
import {
  CCO_ORIGEN_HISTORICO,
  CCO_ORIGEN_V4,
  esIngresoLibroCcoV4,
  fetchAllRows,
} from '@/lib/contabilidad/cco/fetchAllRows';
import { tieneRegistrosGastos } from '@/lib/contabilidad/cco/registrosGastos';
import { cargarDashboardDesdeRegistrosGastos } from '@/lib/contabilidad/cco/cargarDashboardDesdeRegistrosGastos';

export type CcoSeriePunto = {
  periodo: string;
  ingresos: number;
  egresos: number;
  saldo: number;
};

export type CcoProveedorFila = { proveedor: string; costo: number };
export type CcoGastoMensual = { periodo: string; costo: number };

export type CcoCapituloFila = {
  cap: string;
  admin: number;
  materiales: number;
  contratista: number;
  equipos: number;
  insumos: number;
  mano: number;
  transporte: number;
  permiso: number;
  proyecto: number;
};

export type CcoKpiBloque = {
  ingresos: number;
  gastosNetos: number;
  adminDelegada: number;
  costoTotal: number;
  saldoCaja: number;
  countIngresos: number;
  countGastos: number;
};

export type CcoProyectoOpcion = { id: string; nombre: string };

export type CcoHijoJerarquia = {
  nombre: string;
  costo: number;
  pctPadre: number;
  pctTotal: number;
};

export type CcoCapituloJerarquia = {
  nombre: string;
  total: number;
  pctTotal: number;
  hijos: CcoHijoJerarquia[];
};

export type CcoSubCapituloStack = {
  sub: string;
} & Record<string, number | string>;

export type CcoTipoPie = { name: string; value: number; color: string };

export type CcoTreemapNodo = {
  cap: string;
  sub: string;
  costo: number;
  pctPadre: number;
  pctTotal: number;
};

export type CcoDashboard = {
  proyectoId: string | null;
  proyectoNombre: string;
  totalRegistros: number;
  honorariosPct: number;
  devaluacionPromedio: number;
  oficial: CcoKpiBloque;
  real: CcoKpiBloque;
  flujoAcumulado: CcoSeriePunto[];
  flujoPeriodo: CcoSeriePunto[];
  gastosMensual: CcoGastoMensual[];
  topProveedores: CcoProveedorFila[];
  capitulos: CcoCapituloFila[];
  jerarquiaCapitulos: CcoCapituloJerarquia[];
  subCapitulosStack: CcoSubCapituloStack[];
  tiposPie: CcoTipoPie[];
  treemapNodos: CcoTreemapNodo[];
  proyectos: CcoProyectoOpcion[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ym(fecha: string | null | undefined): string | null {
  const s = String(fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s.slice(0, 7);
}

/** Contabilidad Real V4: real = oficial / (1 + devaluación%). */
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

export async function cargarCcoDashboard(
  supabase: SupabaseClient,
  params?: {
    proyectoId?: string | null;
    /** Si se omite, se usa cco_proyecto_config.devaluacion_pct de la obra. */
    devaluacionPromedio?: number | null;
  },
): Promise<CcoDashboard> {
  const proyectoId = params?.proyectoId?.trim() || null;
  const devaluacionOverride =
    params?.devaluacionPromedio != null && Number.isFinite(params.devaluacionPromedio)
      ? Number(params.devaluacionPromedio)
      : null;

  const { data: proyectosRows } = await supabase
    .from('ci_proyectos')
    .select('id,nombre')
    .order('nombre')
    .limit(500);

  const proyectos: CcoProyectoOpcion[] = (proyectosRows ?? []).map((p) => ({
    id: String((p as { id: string }).id),
    nombre: String((p as { nombre?: string }).nombre ?? 'Obra').trim() || 'Obra',
  }));

  const proyectoNombre = proyectoId
    ? proyectos.find((p) => p.id === proyectoId)?.nombre ?? 'Obra seleccionada'
    : 'Todas las obras';

  // Preferir histórico en registros_gastos (~2462 filas RANCHO) cuando exista.
  if (await tieneRegistrosGastos(supabase)) {
    let honorariosPct = 15;
    let devaluacionDesdeConfig: number | null = null;
    if (proyectoId) {
      const { data: cfg } = await supabase
        .from('cco_proyecto_config')
        .select('honorarios_admin_pct,devaluacion_pct')
        .eq('proyecto_id', proyectoId)
        .maybeSingle();
      if (cfg && (cfg as { honorarios_admin_pct?: number }).honorarios_admin_pct != null) {
        honorariosPct = num((cfg as { honorarios_admin_pct?: number }).honorarios_admin_pct);
      }
      if (cfg && (cfg as { devaluacion_pct?: number }).devaluacion_pct != null) {
        devaluacionDesdeConfig = num((cfg as { devaluacion_pct?: number }).devaluacion_pct);
      }
    }
    const devaluacionPromedio = devaluacionOverride ?? devaluacionDesdeConfig ?? 0;
    return cargarDashboardDesdeRegistrosGastos(supabase, {
      proyectoId,
      proyectoNombre,
      proyectos,
      honorariosPct,
      devaluacionPromedio,
    });
  }

  const selectComprasBase =
    'id,fecha,proyecto_id,monto_usd,monto_ves,total_amount,imputacion,supplier_name,origen,origen_v4_id';
  const selectComprasCco = `${selectComprasBase},tipo_gasto_cco,capitulo_cco`;

  const buildComprasQ = (cols: string) => {
    let q = supabase
      .from('contabilidad_compras')
      .select(cols)
      .not('proyecto_id', 'is', null)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .neq('origen', CCO_ORIGEN_HISTORICO)
      .order('fecha', { ascending: true })
      .order('id', { ascending: true });
    if (proyectoId) q = q.eq('proyecto_id', proyectoId);
    return q;
  };

  let { data: comprasRaw, error: cErr } = await fetchAllRows<Record<string, unknown>>(() =>
    buildComprasQ(selectComprasCco),
  );
  if (cErr && /tipo_gasto_cco|capitulo_cco|origen_v4_id|42703|PGRST204|schema cache/i.test(cErr.message ?? '')) {
    // Fallback sin columnas CCO / origen_v4; aún excluye HISTORICO_TABLA si `origen` existe.
    const baseCols = selectComprasBase.replace(',origen_v4_id', '');
    ({ data: comprasRaw, error: cErr } = await fetchAllRows<Record<string, unknown>>(() =>
      buildComprasQ(baseCols),
    ));
    if (cErr && /origen|42703|PGRST204|schema cache/i.test(cErr.message ?? '')) {
      ({ data: comprasRaw, error: cErr } = await fetchAllRows<Record<string, unknown>>(() => {
        let q = supabase
          .from('contabilidad_compras')
          .select(selectComprasBase.replace(',origen,origen_v4_id', ''))
          .not('proyecto_id', 'is', null)
          .neq('imputacion', IMPUTACION_ENTIDAD)
          .order('fecha', { ascending: true })
          .order('id', { ascending: true });
        if (proyectoId) q = q.eq('proyecto_id', proyectoId);
        return q;
      }));
    }
  }
  if (cErr) throw cErr;

  // Si la obra tiene libro V4, no mezclar el histórico legacy (por si el neq falló en fallback).
  const tieneLibroV4 =
    Boolean(proyectoId) &&
    (comprasRaw ?? []).some((r) => {
      const origen = String((r as { origen?: string }).origen ?? '');
      const v4 = (r as { origen_v4_id?: unknown }).origen_v4_id;
      return origen === CCO_ORIGEN_V4 || v4 != null;
    });
  const compras = (comprasRaw ?? []).filter((r) => {
    const origen = String((r as { origen?: string }).origen ?? '');
    if (origen === CCO_ORIGEN_HISTORICO) return false;
    // Obra con libro V4: solo gastos del import V4 (no mezclar Telegram/manual).
    if (tieneLibroV4) {
      const v4 = (r as { origen_v4_id?: unknown }).origen_v4_id;
      return origen === CCO_ORIGEN_V4 || v4 != null;
    }
    return true;
  });

  const { data: inyeccionesRaw, error: iErr } = await fetchAllRows<Record<string, unknown>>(() => {
    let q = supabase
      .from('ci_inyecciones_capital')
      .select('id,fecha_ingreso,creado_al,monto_usd,proyecto_id,creado_por,origen_fondo,banco_origen')
      .order('fecha_ingreso', { ascending: true })
      .order('id', { ascending: true });
    if (proyectoId) q = q.eq('proyecto_id', proyectoId);
    return q;
  });
  if (iErr && iErr.code !== '42P01' && !/ci_inyecciones_capital|schema cache/i.test(iErr.message ?? '')) {
    throw iErr;
  }

  // Con libro V4 de la obra activa, Contabilidad usa solo inyecciones del import.
  const inyecciones = tieneLibroV4
    ? (inyeccionesRaw ?? []).filter((r) =>
        esIngresoLibroCcoV4(r as { creado_por?: string; origen_fondo?: string; banco_origen?: string }),
      )
    : (inyeccionesRaw ?? []);

  let honorariosPct = 15;
  let devaluacionDesdeConfig: number | null = null;

  if (proyectoId) {
    const { data: cfg, error: cfgErr } = await supabase
      .from('cco_proyecto_config')
      .select('honorarios_admin_pct,devaluacion_pct')
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (cfgErr && !/cco_proyecto_config|schema cache|42703|PGRST204/i.test(cfgErr.message ?? '')) {
      throw cfgErr;
    }
    if (cfg && (cfg as { honorarios_admin_pct?: number }).honorarios_admin_pct != null) {
      honorariosPct = num((cfg as { honorarios_admin_pct?: number }).honorarios_admin_pct);
    } else {
      const { data: contrato } = await supabase
        .from('ci_contratos_express')
        .select('honorarios_admin_pct')
        .eq('proyecto_id', proyectoId)
        .eq('tipo_contrato', TIPO_CONTRATO_AD)
        .eq('estado', ESTADO_CONTRATO_EXITOSO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (contrato?.honorarios_admin_pct != null) {
        honorariosPct = num(contrato.honorarios_admin_pct);
      }
    }
    if (cfg && (cfg as { devaluacion_pct?: number }).devaluacion_pct != null) {
      devaluacionDesdeConfig = num((cfg as { devaluacion_pct?: number }).devaluacion_pct);
    }
  } else {
    const { data: contratos } = await supabase
      .from('ci_contratos_express')
      .select('honorarios_admin_pct')
      .eq('tipo_contrato', TIPO_CONTRATO_AD)
      .eq('estado', ESTADO_CONTRATO_EXITOSO)
      .limit(50);
    const pcts = (contratos ?? [])
      .map((c) => num((c as { honorarios_admin_pct?: number }).honorarios_admin_pct))
      .filter((n) => n > 0);
    if (pcts.length) {
      honorariosPct = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    }
  }

  // Override del query param gana; si no, config de obra.
  const devaluacionPromedio = devaluacionOverride ?? devaluacionDesdeConfig ?? 0;

  const porMesIngresos = new Map<string, number>();
  const porMesEgresos = new Map<string, number>();
  const porProveedor = new Map<string, number>();
  const porProyectoUsd = new Map<string, number>();
  /** cap -> tipo -> usd (compras) */
  const porCapTipo = new Map<string, Map<CcoTipoGasto, number>>();
  const porTipoTotal = new Map<CcoTipoGasto, number>();

  let ingresos = 0;
  let countIngresos = 0;
  for (const row of inyecciones ?? []) {
    const usd = num((row as { monto_usd?: number }).monto_usd);
    ingresos += usd;
    countIngresos += 1;
    const periodo = ym(
      (row as { fecha_ingreso?: string }).fecha_ingreso ??
        String((row as { creado_al?: string }).creado_al ?? ''),
    );
    if (periodo) porMesIngresos.set(periodo, (porMesIngresos.get(periodo) ?? 0) + usd);
  }

  const nombrePorId = new Map(proyectos.map((p) => [p.id, p.nombre]));

  let gastosNetos = 0;
  for (const row of compras ?? []) {
    const usd = num((row as { monto_usd?: number }).monto_usd);
    gastosNetos += usd;
    const periodo = ym((row as { fecha?: string }).fecha);
    if (periodo) porMesEgresos.set(periodo, (porMesEgresos.get(periodo) ?? 0) + usd);

    const prov =
      String((row as { supplier_name?: string }).supplier_name ?? '').trim() || 'Sin proveedor';
    porProveedor.set(prov, (porProveedor.get(prov) ?? 0) + usd);

    const pid = String((row as { proyecto_id?: string }).proyecto_id ?? '').trim();
    if (pid) porProyectoUsd.set(pid, (porProyectoUsd.get(pid) ?? 0) + usd);

    const capRaw = String((row as { capitulo_cco?: string }).capitulo_cco ?? '').trim();
    const cap = (
      capRaw ||
      nombrePorId.get(pid) ||
      pid ||
      'SIN CAPÍTULO'
    )
      .slice(0, 28)
      .toUpperCase();
    const tipoPersistido = String((row as { tipo_gasto_cco?: string }).tipo_gasto_cco ?? '').trim();
    const tipo = (CCO_TIPOS_GASTO as readonly string[]).includes(tipoPersistido)
      ? (tipoPersistido as CcoTipoGasto)
      : clasificarTipoGasto(prov);
    if (!porCapTipo.has(cap)) porCapTipo.set(cap, new Map());
    const m = porCapTipo.get(cap)!;
    m.set(tipo, (m.get(tipo) ?? 0) + usd);
    porTipoTotal.set(tipo, (porTipoTotal.get(tipo) ?? 0) + usd);
  }

  const adminDelegada = gastosNetos * (honorariosPct / 100);
  const costoTotal = gastosNetos + adminDelegada;
  const saldoCaja = ingresos - costoTotal;

  // Prorratear admin delegada en cada capítulo
  const totalGastos = gastosNetos || 1;
  for (const [cap, tipos] of Array.from(porCapTipo.entries())) {
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
    void cap;
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
    countGastos: (compras ?? []).length,
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
      const total = Array.from(tipos.values()).reduce((a, b) => a + b, 0);
      const hijos: CcoHijoJerarquia[] = Array.from(tipos.entries())
        .filter(([, c]) => c > 0)
        .map(([n, costo]) => ({
          nombre: n,
          costo,
          pctPadre: total > 0 ? (costo / total) * 100 : 0,
          pctTotal: (costo / grandTotal) * 100,
        }))
        .sort((a, b) => b.costo - a.costo);
      return {
        nombre,
        total,
        pctTotal: (total / grandTotal) * 100,
        hijos,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  /** Eje X = capítulo/obra; stack = tipo de gasto (misma composición que captura V4). */
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
    proyectoId,
    proyectoNombre,
    totalRegistros: (compras?.length ?? 0) + (inyecciones?.length ?? 0),
    honorariosPct,
    devaluacionPromedio,
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
    proyectos,
  };
}
