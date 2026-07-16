import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { TIPO_CONTRATO_AD, ESTADO_CONTRATO_EXITOSO } from '@/lib/proyectos/contratoAdministracionDelegada';
import {
  CCO_TIPOS_GASTO,
  CCO_TIPO_COLOR_PIE,
  clasificarTipoGasto,
  etiquetaCorta,
  parseJerarquiaDesdeTexto,
  resolverTipoGastoTexto,
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

type CompraRow = {
  id: string;
  fecha?: string;
  proyecto_id?: string;
  monto_usd?: number;
  monto_ves?: number;
  total_amount?: number;
  imputacion?: string;
  supplier_name?: string;
  contabilidad_compra_lineas?:
    | { descripcion?: string; subtotal?: number }[]
    | { descripcion?: string; subtotal?: number }
    | null;
};

type GastoObraRow = {
  fecha?: string | null;
  disciplina?: string | null;
  tipo?: string | null;
  costo?: number | null;
  descripcion?: string | null;
  proveedor?: string | null;
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

function tipKey(t: CcoTipoGasto): Exclude<keyof CcoCapituloFila, 'cap'> {
  const map: Record<CcoTipoGasto, Exclude<keyof CcoCapituloFila, 'cap'>> = {
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
}

function addTriple(
  porCapTipo: Map<string, Map<CcoTipoGasto, number>>,
  porCapSub: Map<string, Map<string, number>>,
  porSubTipo: Map<string, Map<CcoTipoGasto, number>>,
  porTipoTotal: Map<CcoTipoGasto, number>,
  cap: string,
  sub: string,
  tipo: CcoTipoGasto,
  usd: number,
) {
  if (!(usd > 0)) return;
  if (!porCapTipo.has(cap)) porCapTipo.set(cap, new Map());
  const ct = porCapTipo.get(cap)!;
  ct.set(tipo, (ct.get(tipo) ?? 0) + usd);

  if (!porCapSub.has(cap)) porCapSub.set(cap, new Map());
  const cs = porCapSub.get(cap)!;
  cs.set(sub, (cs.get(sub) ?? 0) + usd);

  if (!porSubTipo.has(sub)) porSubTipo.set(sub, new Map());
  const st = porSubTipo.get(sub)!;
  st.set(tipo, (st.get(tipo) ?? 0) + usd);

  porTipoTotal.set(tipo, (porTipoTotal.get(tipo) ?? 0) + usd);
}

function lineasDeCompra(row: CompraRow): { descripcion: string; subtotal: number }[] {
  const nested = row.contabilidad_compra_lineas;
  if (!nested) return [];
  const arr = Array.isArray(nested) ? nested : [nested];
  return arr
    .map((l) => ({
      descripcion: String(l.descripcion ?? '').trim(),
      subtotal: num(l.subtotal),
    }))
    .filter((l) => l.descripcion || l.subtotal > 0);
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
      'id,fecha,proyecto_id,monto_usd,monto_ves,total_amount,imputacion,supplier_name,contabilidad_compra_lineas(descripcion,subtotal)',
    )
    .not('proyecto_id', 'is', null)
    .neq('imputacion', IMPUTACION_ENTIDAD)
    .order('fecha', { ascending: true })
    .limit(8000);

  if (proyectoId) comprasQ = comprasQ.eq('proyecto_id', proyectoId);

  const comprasRes = await comprasQ;
  let compras: CompraRow[] = (comprasRes.data ?? []) as CompraRow[];

  // Fallback si el embed de líneas no está disponible
  if (comprasRes.error) {
    let fbQ = supabase
      .from('contabilidad_compras')
      .select('id,fecha,proyecto_id,monto_usd,monto_ves,total_amount,imputacion,supplier_name')
      .not('proyecto_id', 'is', null)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .order('fecha', { ascending: true })
      .limit(8000);
    if (proyectoId) fbQ = fbQ.eq('proyecto_id', proyectoId);
    const fb = await fbQ;
    if (fb.error) throw fb.error;
    compras = (fb.data ?? []) as CompraRow[];
  }

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

  /** Complemento opcional: gastos_obra (disciplina = sub-capítulo). */
  let gastosObra: GastoObraRow[] = [];
  if (proyectoId) {
    const gQ = await supabase
      .from('gastos_obra')
      .select('fecha,disciplina,tipo,costo,descripcion,proveedor')
      .eq('proyecto_id', proyectoId)
      .limit(8000);
    if (!gQ.error) gastosObra = (gQ.data ?? []) as GastoObraRow[];
  }

  const porMesIngresos = new Map<string, number>();
  const porMesEgresos = new Map<string, number>();
  const porProveedor = new Map<string, number>();
  /** cap -> tipo -> usd */
  const porCapTipo = new Map<string, Map<CcoTipoGasto, number>>();
  /** cap -> sub -> usd (sunburst / treemap) */
  const porCapSub = new Map<string, Map<string, number>>();
  /** sub -> tipo -> usd (barras apiladas sub-capítulo) */
  const porSubTipo = new Map<string, Map<CcoTipoGasto, number>>();
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
  let jerarquiaDesdeLineas = 0;

  for (const row of compras) {
    const usd = num(row.monto_usd);
    gastosNetos += usd;
    const periodo = ym(row.fecha);
    if (periodo) porMesEgresos.set(periodo, (porMesEgresos.get(periodo) ?? 0) + usd);

    const prov = String(row.supplier_name ?? '').trim() || 'Sin proveedor';
    porProveedor.set(prov, (porProveedor.get(prov) ?? 0) + usd);

    const pid = String(row.proyecto_id ?? '').trim();
    const capFallback = (nombrePorId.get(pid) ?? (pid || 'SIN CAPÍTULO')).slice(0, 28).toUpperCase();
    const tipoFallback = clasificarTipoGasto(prov);
    const lineas = lineasDeCompra(row);

    if (lineas.length > 0 && usd > 0) {
      const sumSub = lineas.reduce((s, l) => s + Math.max(l.subtotal, 0), 0);
      for (const linea of lineas) {
        const share =
          sumSub > 0 ? (Math.max(linea.subtotal, 0) / sumSub) * usd : usd / lineas.length;
        const parsed = parseJerarquiaDesdeTexto(linea.descripcion);
        const tipo = parsed.tipo ?? tipoFallback;
        const cap = (parsed.capitulo || capFallback).slice(0, 28).toUpperCase();
        const sub = (parsed.subcapitulo || parsed.tipo || tipo).slice(0, 28).toUpperCase();
        if (parsed.capitulo || parsed.subcapitulo) jerarquiaDesdeLineas += 1;
        addTriple(porCapTipo, porCapSub, porSubTipo, porTipoTotal, cap, sub, tipo, share);
      }
    } else {
      addTriple(
        porCapTipo,
        porCapSub,
        porSubTipo,
        porTipoTotal,
        capFallback,
        tipoFallback,
        tipoFallback,
        usd,
      );
    }
  }

  // Si hay gastos_obra con disciplina, enriquecer (o reemplazar jerarquía cuando no hubo CSV)
  for (const g of gastosObra) {
    const costo = num(g.costo);
    if (!(costo > 0)) continue;
    const parsed = parseJerarquiaDesdeTexto(
      [g.tipo, g.disciplina, g.descripcion].filter(Boolean).join(' · '),
    );
    const tipo =
      resolverTipoGastoTexto(String(g.tipo ?? '')) ||
      parsed.tipo ||
      clasificarTipoGasto(String(g.proveedor ?? g.descripcion ?? ''));
    const cap = (
      parsed.capitulo ||
      (proyectoNombre !== 'Todas las obras' ? proyectoNombre : 'OBRA')
    )
      .slice(0, 28)
      .toUpperCase();
    const sub = (parsed.subcapitulo || String(g.disciplina ?? '').trim() || tipo)
      .slice(0, 28)
      .toUpperCase();

    // Solo agregar si no teníamos jerarquía de líneas CSV (evitar doble conteo)
    if (jerarquiaDesdeLineas === 0) {
      const periodo = ym(g.fecha);
      if (periodo) porMesEgresos.set(periodo, (porMesEgresos.get(periodo) ?? 0) + costo);
      gastosNetos += costo;
      const prov = String(g.proveedor ?? '').trim() || 'Sin proveedor';
      porProveedor.set(prov, (porProveedor.get(prov) ?? 0) + costo);
      addTriple(porCapTipo, porCapSub, porSubTipo, porTipoTotal, cap, sub, tipo, costo);
    } else if (parsed.subcapitulo || String(g.disciplina ?? '').trim()) {
      // Ya contamos compras; no sumar de nuevo al total, pero si faltan subs reales
      // no tocamos montos para no duplicar.
      void 0;
    }
  }

  const adminDelegada = gastosNetos * (honorariosPct / 100);
  const costoTotal = gastosNetos + adminDelegada;
  const saldoCaja = ingresos - costoTotal;

  // Prorratear admin delegada en cada capítulo / sub
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
      // Prorratear admin a sub-capítulos del capítulo
      const subs = porCapSub.get(cap);
      if (subs && subs.size) {
        const subTotal = Array.from(subs.values()).reduce((a, b) => a + b, 0) || 1;
        for (const [sub, subUsd] of Array.from(subs.entries())) {
          const share = adminShare * (subUsd / subTotal);
          subs.set(sub, subUsd + share);
          if (!porSubTipo.has(sub)) porSubTipo.set(sub, new Map());
          const st = porSubTipo.get(sub)!;
          st.set(
            'ADMINISTRACIÓN DELEGADA',
            (st.get('ADMINISTRACIÓN DELEGADA') ?? 0) + share,
          );
        }
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

  const capitulos: CcoCapituloFila[] = Array.from(porCapTipo.entries())
    .map(([cap, tipos]) => {
      const row: CcoCapituloFila = {
        cap: etiquetaCorta(cap, 22),
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
      const ta =
        a.admin + a.materiales + a.contratista + a.equipos + a.insumos + a.mano + a.transporte;
      const tb =
        b.admin + b.materiales + b.contratista + b.equipos + b.insumos + b.mano + b.transporte;
      return tb - ta;
    })
    .slice(0, 12);

  /** Sunburst / treemap: hijos = Sub-Capítulos reales (no tipos de gasto). */
  const jerarquiaCapitulos: CcoCapituloJerarquia[] = Array.from(porCapSub.entries())
    .map(([nombre, subs]) => {
      const total = Array.from(subs.values()).reduce((a, b) => a + b, 0);
      const hijos: CcoHijoJerarquia[] = Array.from(subs.entries())
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

  /** Eje X = Sub-Capítulo; stack = Tipo de Gasto. */
  const subCapitulosStack: CcoSubCapituloStack[] = Array.from(porSubTipo.entries())
    .map(([sub, tipos]) => {
      const row: CcoSubCapituloStack = { sub: etiquetaCorta(sub, 18) };
      let total = 0;
      for (const t of CCO_TIPOS_GASTO) {
        const v = tipos.get(t) ?? 0;
        row[t] = v;
        total += v;
      }
      return { row, total };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 18)
    .map((x) => x.row);

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
