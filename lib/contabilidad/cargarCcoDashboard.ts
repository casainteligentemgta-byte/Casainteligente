import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { TIPO_CONTRATO_AD, ESTADO_CONTRATO_EXITOSO } from '@/lib/proyectos/contratoAdministracionDelegada';
import {
  CCO_TIPOS_GASTO,
  CCO_TIPO_COLOR_PIE,
  clasificarTipoGasto,
  type CcoTipoGasto,
} from '@/lib/contabilidad/ccoClasificarGasto';

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
  params?: { proyectoId?: string | null; devaluacionPromedio?: number },
): Promise<CcoDashboard> {
  const proyectoId = params?.proyectoId?.trim() || null;
  const devaluacionPromedio = Number.isFinite(params?.devaluacionPromedio)
    ? Number(params!.devaluacionPromedio)
    : 0;

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

  let comprasQ = supabase
    .from('contabilidad_compras')
    .select(
      'id,fecha,proyecto_id,monto_usd,monto_ves,total_amount,imputacion,supplier_name',
    )
    .not('proyecto_id', 'is', null)
    .neq('imputacion', IMPUTACION_ENTIDAD)
    .order('fecha', { ascending: true })
    .limit(8000);

  if (proyectoId) comprasQ = comprasQ.eq('proyecto_id', proyectoId);

  const { data: compras, error: cErr } = await comprasQ;
  if (cErr) throw cErr;

  let inyQ = supabase
    .from('ci_inyecciones_capital')
    .select('id,fecha_ingreso,creado_al,monto_usd,proyecto_id')
    .order('fecha_ingreso', { ascending: true })
    .limit(8000);

  if (proyectoId) inyQ = inyQ.eq('proyecto_id', proyectoId);

  const { data: inyecciones, error: iErr } = await inyQ;
  if (iErr && iErr.code !== '42P01' && !/ci_inyecciones_capital|schema cache/i.test(iErr.message ?? '')) {
    throw iErr;
  }

  let honorariosPct = 12;
  if (proyectoId) {
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

    const cap = (nombrePorId.get(pid) ?? (pid || 'SIN CAPÍTULO')).slice(0, 28).toUpperCase();
    const tipo = clasificarTipoGasto(prov);
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
  for (const [cap, tipos] of porCapTipo) {
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

  const tipKey = (t: CcoTipoGasto): keyof CcoCapituloFila => {
    const map: Record<CcoTipoGasto, keyof CcoCapituloFila> = {
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
      for (const [t, v] of tipos) row[tipKey(t)] = v;
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
