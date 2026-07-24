import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { TIPO_CONTRATO_AD, ESTADO_CONTRATO_EXITOSO } from '@/lib/proyectos/contratoAdministracionDelegada';
import {
  CCO_TIPOS_GASTO,
  CCO_TIPO_COLOR_PIE,
  clasificarTipoGasto,
  type CcoTipoGasto,
} from '@/lib/contabilidad/ccoClasificarGasto';
import {
  calcularKpisOficiales,
  esGastoAnulado,
  honorariosDeFila,
  resolverMontoBaseUsdKpi,
} from '@/lib/contabilidad/cco/kpisOficiales';
import { normalizarDevaluacionConfig } from '@/lib/contabilidad/cco/tasas';
import {
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';
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

/** Fila del detalle V4: Capítulo → Sub-Capítulo → Tipo de gasto. */
export type CcoDetalleJerarquia = {
  capitulo: string;
  subcapitulo: string;
  tipo: string;
  costo: number;
};

/** Total por capítulo (misma forma que tabla «Distribución por Capítulo» V4). */
export type CcoCapituloTotal = { capitulo: string; costo: number };

export type CcoDashboard = {
  proyectoId: string | null;
  proyectoNombre: string;
  totalRegistros: number;
  honorariosPct: number;
  devaluacionPromedio: number;
  /** Origen de la brecha/devaluación cuando el libro viene de registros_gastos. */
  brechaFuente?: 'filas_registros_gastos' | 'config' | 'manual';
  oficial: CcoKpiBloque;
  real: CcoKpiBloque;
  flujoAcumulado: CcoSeriePunto[];
  flujoPeriodo: CcoSeriePunto[];
  gastosMensual: CcoGastoMensual[];
  topProveedores: CcoProveedorFila[];
  capitulos: CcoCapituloFila[];
  /** Totales simples por capítulo (barras V4). */
  capitulosTotal: CcoCapituloTotal[];
  jerarquiaCapitulos: CcoCapituloJerarquia[];
  subCapitulosStack: CcoSubCapituloStack[];
  tiposPie: CcoTipoPie[];
  treemapNodos: CcoTreemapNodo[];
  /** Detalle completo capítulo / subcapítulo / tipo. */
  detalleJerarquia: CcoDetalleJerarquia[];
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

function aplicarDevaluacion(oficial: CcoKpiBloque, devalPct: number): CcoKpiBloque {
  const f = 1 + devalPct / 100;
  return {
    ingresos: oficial.ingresos * f,
    gastosNetos: oficial.gastosNetos * f,
    adminDelegada: oficial.adminDelegada * f,
    costoTotal: oficial.costoTotal * f,
    saldoCaja: oficial.saldoCaja * f,
    countIngresos: oficial.countIngresos,
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

  // Preferir histórico sincronizado/importado en registros_gastos de la obra.
  if (proyectoId && (await tieneRegistrosGastos(supabase, proyectoId))) {
    let honorariosPct = 15;
    let devaluacionDesdeConfig: number | null = null;
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
    const devaluacionPromedio = devaluacionOverride ?? devaluacionDesdeConfig ?? 0;
    return cargarDashboardDesdeRegistrosGastos(supabase, {
      proyectoId,
      proyectoNombre,
      proyectos,
      honorariosPct,
      devaluacionPromedio,
      forzarDevaluacionManual: devaluacionOverride != null,
    });
  }

  const selectComprasBase =
    'id,fecha,proyecto_id,monto_usd,monto_ves,total_amount,imputacion,supplier_name,notas,invoice_number,tasa_bcv_ves_por_usd,moneda_original';
  const selectComprasCco = `${selectComprasBase},tipo_gasto_cco,capitulo_cco,subcapitulo_cco,honorarios_usd,admin_pct_override,cco_estado,tasa_binance,porcentaje_brecha_real`;

  type CompraRow = Record<string, unknown>;

  async function fetchAllCompras(cols: string): Promise<{ data: CompraRow[]; error: { message?: string } | null }> {
    const pageSize = 1000;
    const all: CompraRow[] = [];
    let from = 0;
    for (let guard = 0; guard < 60; guard += 1) {
      let q = supabase
        .from('contabilidad_compras')
        .select(cols)
        .not('proyecto_id', 'is', null)
        .neq('imputacion', IMPUTACION_ENTIDAD)
        .order('fecha', { ascending: true })
        .range(from, from + pageSize - 1);
      if (proyectoId) q = q.eq('proyecto_id', proyectoId);
      const { data, error } = await q;
      if (error) return { data: all, error };
      const batch = (data ?? []) as unknown as CompraRow[];
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return { data: all, error: null };
  }

  let { data: compras, error: cErr } = await fetchAllCompras(selectComprasCco);
  if (
    cErr &&
    /tipo_gasto_cco|capitulo_cco|subcapitulo_cco|honorarios_usd|cco_estado|42703|PGRST204|schema cache/i.test(
      cErr.message ?? '',
    )
  ) {
    const selectSinSub = `${selectComprasBase},tipo_gasto_cco,capitulo_cco,honorarios_usd,admin_pct_override,cco_estado,tasa_binance,porcentaje_brecha_real`;
    ({ data: compras, error: cErr } = await fetchAllCompras(selectSinSub));
    if (
      cErr &&
      /tipo_gasto_cco|capitulo_cco|honorarios_usd|cco_estado|42703|PGRST204|schema cache/i.test(
        cErr.message ?? '',
      )
    ) {
      ({ data: compras, error: cErr } = await fetchAllCompras(selectComprasBase));
    }
  }
  if (cErr) throw cErr;

  async function fetchAllInyecciones(): Promise<{
    data: CompraRow[];
    error: { message?: string; code?: string } | null;
  }> {
    const pageSize = 1000;
    const all: CompraRow[] = [];
    let from = 0;
    for (let guard = 0; guard < 60; guard += 1) {
      let q = supabase
        .from('ci_inyecciones_capital')
        .select('id,fecha_ingreso,creado_al,monto_usd,proyecto_id')
        .order('fecha_ingreso', { ascending: true })
        .range(from, from + pageSize - 1);
      if (proyectoId) q = q.eq('proyecto_id', proyectoId);
      const { data, error } = await q;
      if (error) return { data: all, error };
      const batch = (data ?? []) as unknown as CompraRow[];
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return { data: all, error: null };
  }

  const { data: inyecciones, error: iErr } = await fetchAllInyecciones();
  if (iErr && iErr.code !== '42P01' && !/ci_inyecciones_capital|schema cache/i.test(iErr.message ?? '')) {
    throw iErr;
  }

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

  const porMesIngresos = new Map<string, number>();
  const porMesEgresos = new Map<string, number>();
  const porProveedor = new Map<string, number>();
  const porProyectoUsd = new Map<string, number>();
  /** cap -> tipo -> usd (compras + admin prorrateado) */
  const porCapTipo = new Map<string, Map<CcoTipoGasto, number>>();
  const porTipoTotal = new Map<CcoTipoGasto, number>();
  /** clave "cap||sub||tipo" → usd (detalle V4) */
  const porDetalle = new Map<string, { capitulo: string; subcapitulo: string; tipo: CcoTipoGasto; costo: number }>();

  const ingresosUsdList: number[] = [];
  for (const row of inyecciones ?? []) {
    const usd = num((row as { monto_usd?: number }).monto_usd);
    ingresosUsdList.push(usd);
    const periodo = ym(
      (row as { fecha_ingreso?: string }).fecha_ingreso ??
        String((row as { creado_al?: string }).creado_al ?? ''),
    );
    if (periodo) porMesIngresos.set(periodo, (porMesIngresos.get(periodo) ?? 0) + usd);
  }

  const nombrePorId = new Map(proyectos.map((p) => [p.id, p.nombre]));

  function esFilaAuditoriaKpi(r: CompraRow): boolean {
    const notas = r.notas != null ? String(r.notas) : '';
    const invoice = r.invoice_number != null ? String(r.invoice_number) : '';
    if (esDescripcionAuditoriaCco(notas)) return true;
    return esCompraSoloAuditoriaCco({
      supplier_name: r.supplier_name != null ? String(r.supplier_name) : null,
      notas,
      invoice_number: invoice,
      lineas: notas ? [{ descripcion: notas }] : [],
    });
  }

  const comprasKpi = (compras ?? []).filter((row) => !esFilaAuditoriaKpi(row as CompraRow));
  const gastosKpiInput = comprasKpi.map((row) => row as CompraRow);

  const kpisCalc = calcularKpisOficiales({
    ingresosUsd: ingresosUsdList,
    gastos: gastosKpiInput.map((r) => ({
      monto_usd: num(r.monto_usd),
      monto_ves: num(r.monto_ves),
      tasa_bcv_ves_por_usd: num(r.tasa_bcv_ves_por_usd),
      tasa_binance: num(r.tasa_binance),
      moneda_original: r.moneda_original != null ? String(r.moneda_original) : null,
      honorarios_usd: r.honorarios_usd != null ? num(r.honorarios_usd) : null,
      admin_pct_override: r.admin_pct_override != null ? num(r.admin_pct_override) : null,
      cco_estado: r.cco_estado != null ? String(r.cco_estado) : null,
      porcentaje_brecha_real:
        r.porcentaje_brecha_real != null ? num(r.porcentaje_brecha_real) : null,
    })),
    honorariosPctGlobal: honorariosPct,
  });

  // Siempre forma V4 (−): override/config con brecha + (p. ej. 34,45) → ≈ −25,62.
  const devaluacionPromedio = normalizarDevaluacionConfig(
    devaluacionOverride != null
      ? devaluacionOverride
      : devaluacionDesdeConfig != null
        ? devaluacionDesdeConfig
        : kpisCalc.devaluacionPromedioBrechas !== 0
          ? kpisCalc.devaluacionPromedioBrechas
          : 0,
  );

  // Autocorregir config en BD si todavía tiene la brecha cruda positiva.
  if (
    proyectoId &&
    devaluacionDesdeConfig != null &&
    Math.abs(normalizarDevaluacionConfig(devaluacionDesdeConfig) - devaluacionDesdeConfig) > 0.00001
  ) {
    void supabase
      .from('cco_proyecto_config')
      .update({
        devaluacion_pct: normalizarDevaluacionConfig(devaluacionDesdeConfig),
        updated_at: new Date().toISOString(),
      })
      .eq('proyecto_id', proyectoId);
  }

  const {
    ingresos,
    gastosNetos,
    adminDelegada,
    costoTotal,
    saldoCaja,
    countIngresos,
  } = kpisCalc;

  for (const row of comprasKpi) {
    const r = row as CompraRow;
    if (esGastoAnulado(r.cco_estado != null ? String(r.cco_estado) : null)) continue;
    const usd = resolverMontoBaseUsdKpi({
      monto_usd: num(r.monto_usd),
      monto_ves: num(r.monto_ves),
      tasa_bcv_ves_por_usd: num(r.tasa_bcv_ves_por_usd),
      tasa_binance: num(r.tasa_binance),
      moneda_original: r.moneda_original != null ? String(r.moneda_original) : null,
    });
    if (usd <= 0) continue;
    const honorarios = honorariosDeFila(
      usd,
      {
        honorarios_usd: r.honorarios_usd != null ? num(r.honorarios_usd) : null,
        admin_pct_override: r.admin_pct_override != null ? num(r.admin_pct_override) : null,
      },
      honorariosPct,
    );
    // Flujo de caja del gráfico: costo (base + admin) para cuadrar con SALDO EN CAJA.
    const costoFila = usd + honorarios;
    const periodo = ym(r.fecha != null ? String(r.fecha) : null);
    if (periodo) porMesEgresos.set(periodo, (porMesEgresos.get(periodo) ?? 0) + costoFila);

    const prov = String(r.supplier_name ?? '').trim() || 'Sin proveedor';
    porProveedor.set(prov, (porProveedor.get(prov) ?? 0) + usd);

    const pid = String(r.proyecto_id ?? '').trim();
    if (pid) porProyectoUsd.set(pid, (porProyectoUsd.get(pid) ?? 0) + usd);

    const capRaw = String(r.capitulo_cco ?? '').trim();
    const cap = (
      capRaw ||
      nombrePorId.get(pid) ||
      pid ||
      'SIN CAPÍTULO'
    )
      .slice(0, 28)
      .toUpperCase();
    const subRaw = String(r.subcapitulo_cco ?? '').trim();
    const sub = (subRaw || cap).slice(0, 40).toUpperCase();
    const tipoPersistido = String(r.tipo_gasto_cco ?? '').trim();
    const tipo = (CCO_TIPOS_GASTO as readonly string[]).includes(tipoPersistido)
      ? (tipoPersistido as CcoTipoGasto)
      : clasificarTipoGasto(prov);
    if (!porCapTipo.has(cap)) porCapTipo.set(cap, new Map());
    const m = porCapTipo.get(cap)!;
    m.set(tipo, (m.get(tipo) ?? 0) + usd);
    porTipoTotal.set(tipo, (porTipoTotal.get(tipo) ?? 0) + usd);

    const detKey = `${cap}||${sub}||${tipo}`;
    const prev = porDetalle.get(detKey);
    if (prev) prev.costo += usd;
    else porDetalle.set(detKey, { capitulo: cap, subcapitulo: sub, tipo, costo: usd });
  }

  // Prorratear admin delegada en cada capítulo (misma proporción que V4)
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
      // Fila de detalle al estilo V4 (capítulo / admin / admin)
      const detKey = `${cap}||ADMINISTRACIÓN DELEGADA||ADMINISTRACIÓN DELEGADA`;
      const prev = porDetalle.get(detKey);
      if (prev) prev.costo += adminShare;
      else {
        porDetalle.set(detKey, {
          capitulo: cap,
          subcapitulo: 'ADMINISTRACIÓN DELEGADA',
          tipo: 'ADMINISTRACIÓN DELEGADA',
          costo: adminShare,
        });
      }
    }
  }

  const grandTotal =
    Array.from(porCapTipo.values()).reduce(
      (acc, tipos) => acc + Array.from(tipos.values()).reduce((a, b) => a + b, 0),
      0,
    ) || 1;

  const oficial: CcoKpiBloque = {
    ingresos,
    gastosNetos,
    adminDelegada,
    costoTotal,
    saldoCaja,
    countIngresos,
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

  const capitulosTotal: CcoCapituloTotal[] = Array.from(porCapTipo.entries())
    .map(([capitulo, tipos]) => ({
      capitulo,
      costo: Array.from(tipos.values()).reduce((a, b) => a + b, 0),
    }))
    .filter((r) => r.costo > 0)
    .sort((a, b) => b.costo - a.costo);

  const detalleJerarquia: CcoDetalleJerarquia[] = Array.from(porDetalle.values())
    .filter((r) => r.costo > 0)
    .map((r) => ({
      capitulo: r.capitulo,
      subcapitulo: r.subcapitulo,
      tipo: r.tipo,
      costo: r.costo,
    }))
    .sort((a, b) => b.costo - a.costo);

  return {
    proyectoId,
    proyectoNombre,
    totalRegistros: comprasKpi.length + (inyecciones?.length ?? 0),
    honorariosPct,
    devaluacionPromedio,
    oficial,
    real: aplicarDevaluacion(oficial, devaluacionPromedio),
    flujoAcumulado,
    flujoPeriodo,
    gastosMensual,
    topProveedores,
    capitulos,
    capitulosTotal,
    jerarquiaCapitulos,
    subCapitulosStack,
    tiposPie,
    treemapNodos,
    detalleJerarquia,
    proyectos,
  };
}
