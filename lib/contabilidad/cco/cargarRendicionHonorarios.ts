import type { SupabaseClient } from '@supabase/supabase-js';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import {
  esDescripcionAuditoriaCco,
  esFilaAuditoriaKpiCco,
  esNotaImportacionGenericaCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { ESTADO_CONTRATO_EXITOSO, TIPO_CONTRATO_AD } from '@/lib/proyectos/contratoAdministracionDelegada';
import { cargarLibroMaestro } from '@/lib/contabilidad/cco/cargarLibroMaestro';
import { parseOrigenIngreso } from '@/lib/contabilidad/cco/ingresosVista';
import {
  esGastoAnulado,
  honorariosDeFila,
  resolverMontoBaseUsdKpi,
} from '@/lib/contabilidad/cco/kpisOficiales';
import { obtenerConfigCco } from '@/lib/contabilidad/cco/proyectoConfig';
import { tieneRegistrosGastos } from '@/lib/contabilidad/cco/registrosGastos';
import {
  construirRendicion,
  rangoRendicion,
  type MovimientoRendicion,
  type PeriodoRendicion,
  type RendicionHonorarios,
} from '@/lib/contabilidad/cco/rendicionHonorarios';

type Fila = Record<string, unknown>;

export type RendicionCargada = {
  obra: string;
  cliente: string | null;
  /** Quien administra la obra y emite la rendición. */
  empresa: string;
  proyectoId: string;
  rendicion: RendicionHonorarios;
};

const COLS_GASTO_BASE =
  'id,fecha,supplier_name,notas,invoice_number,monto_usd,monto_ves,tasa_bcv_ves_por_usd,moneda_original';
const COLS_GASTO_CCO = `${COLS_GASTO_BASE},tasa_binance,tipo_gasto_cco,capitulo_cco,honorarios_usd,admin_pct_override,cco_estado,forma_pago_cco,document_storage_path,purchase_invoice_id`;
const RE_COLUMNA_AUSENTE =
  /tipo_gasto_cco|capitulo_cco|honorarios_usd|cco_estado|forma_pago_cco|document_storage_path|purchase_invoice_id|tasa_binance|42703|PGRST204|schema cache/i;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function txt(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Trae todas las filas de una consulta paginando de 1000 en 1000. */
async function traerTodo(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>,
): Promise<{ data: Fila[]; error: { message?: string; code?: string } | null }> {
  const pagina = 1000;
  const todo: Fila[] = [];
  for (let desde = 0, vuelta = 0; vuelta < 100; vuelta += 1, desde += pagina) {
    const { data, error } = await consulta(desde, desde + pagina - 1);
    if (error) return { data: todo, error };
    const lote = (data ?? []) as Fila[];
    todo.push(...lote);
    if (lote.length < pagina) break;
  }
  return { data: todo, error: null };
}

/** Quita el prefijo «RUBRO: … |» de las notas de egresos manuales antiguos. */
function limpiarNotas(notas: string): string {
  const m = notas.match(/^RUBRO:\s*[^|\n]+\|\s*(.+)$/i);
  if (m?.[1]?.trim()) return m[1].trim();
  if (/^RUBRO:/i.test(notas)) return '';
  return notas.trim();
}

function conceptoDebil(concepto: string, factura: string | null): boolean {
  return !concepto || concepto === 'Gasto' || (factura != null && concepto === factura);
}

/**
 * Convierte una fila de contabilidad_compras en un gasto de la rendición con las
 * mismas reglas que el tablero CCO. Devuelve null si la fila no cuenta como gasto
 * (bitácora del programa, anulada o sin monto).
 */
export function gastoDesdeCompra(r: Fila, pctPactado: number): MovimientoRendicion | null {
  if (esFilaAuditoriaKpiCco(r)) return null;
  if (esGastoAnulado(r.cco_estado != null ? String(r.cco_estado) : null)) return null;

  const base = resolverMontoBaseUsdKpi({
    monto_usd: num(r.monto_usd),
    monto_ves: num(r.monto_ves),
    tasa_bcv_ves_por_usd: num(r.tasa_bcv_ves_por_usd),
    tasa_binance: num(r.tasa_binance),
    moneda_original: r.moneda_original != null ? String(r.moneda_original) : null,
  });
  if (base <= 0) return null;

  const honorariosGuardados = r.honorarios_usd != null;
  const honorarios = honorariosDeFila(
    base,
    {
      honorarios_usd: honorariosGuardados ? num(r.honorarios_usd) : null,
      admin_pct_override: r.admin_pct_override != null ? num(r.admin_pct_override) : null,
    },
    pctPactado,
  );

  const proveedor = txt(r.supplier_name) || 'Sin proveedor';
  const factura = txt(r.invoice_number) || null;
  const notas = limpiarNotas(txt(r.notas));
  const concepto = (notas && !esNotaImportacionGenericaCco(notas) ? notas : '') || factura || 'Gasto';

  return {
    id: String(r.id),
    clase: 'GASTO',
    fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
    proveedor,
    concepto,
    factura,
    tipo: txt(r.tipo_gasto_cco) || clasificarTipoGasto(proveedor),
    capitulo: txt(r.capitulo_cco) || '—',
    baseUsd: base,
    honorariosUsd: honorarios,
    honorariosGuardados,
    estado: txt(r.cco_estado) || 'PAGADO',
    formaPago: txt(r.forma_pago_cco) || null,
    tieneSoporte: Boolean(txt(r.document_storage_path) || txt(r.purchase_invoice_id)),
  };
}

export function aporteDesdeInyeccion(r: Fila): MovimientoRendicion | null {
  const monto = num(r.monto_usd);
  if (monto <= 0) return null;
  const origen = parseOrigenIngreso(txt(r.origen_fondo));
  return {
    id: String(r.id),
    clase: 'INGRESO',
    fecha: txt(r.fecha_ingreso ?? r.creado_al).slice(0, 10) || null,
    proveedor: origen.proveedor || 'CLIENTE',
    concepto: origen.descripcion || 'Aporte',
    factura: null,
    tipo: 'INGRESO',
    capitulo: '—',
    baseUsd: monto,
    honorariosUsd: 0,
    honorariosGuardados: true,
    estado: 'RECIBIDO',
    formaPago: txt(r.metodo_pago) || null,
    tieneSoporte: Boolean(txt(r.soporte_storage_path)),
  };
}

/** En el detalle, cambia «Gasto» o el número de factura por lo que dicen las líneas de la compra. */
async function mejorarConceptos(supabase: SupabaseClient, gastos: MovimientoRendicion[]): Promise<void> {
  const ids = gastos.filter((g) => conceptoDebil(g.concepto, g.factura)).map((g) => g.id);
  if (!ids.length) return;

  const porCompra = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('contabilidad_compra_lineas')
      .select('compra_id,descripcion')
      .in('compra_id', ids.slice(i, i + 200))
      .order('created_at', { ascending: true });
    if (error) return;
    for (const fila of (data ?? []) as Fila[]) {
      const compra = txt(fila.compra_id);
      const d = txt(fila.descripcion);
      if (!compra || !d || esDescripcionAuditoriaCco(d)) continue;
      const lista = porCompra.get(compra) ?? [];
      if (lista.length < 3) lista.push(d);
      porCompra.set(compra, lista);
    }
  }
  for (const g of gastos) {
    const partes = porCompra.get(g.id);
    if (partes?.length && conceptoDebil(g.concepto, g.factura)) g.concepto = partes.join(' · ');
  }
}

async function movimientosDesdeCompras(
  supabase: SupabaseClient,
  proyectoId: string,
  pctPactado: number,
): Promise<MovimientoRendicion[]> {
  const traerGastos = (cols: string) =>
    traerTodo((desde, hasta) =>
      supabase
        .from('contabilidad_compras')
        .select(cols)
        .eq('proyecto_id', proyectoId)
        .neq('imputacion', IMPUTACION_ENTIDAD)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true })
        .range(desde, hasta),
    );

  let compras = await traerGastos(COLS_GASTO_CCO);
  if (compras.error && RE_COLUMNA_AUSENTE.test(compras.error.message ?? '')) {
    compras = await traerGastos(COLS_GASTO_BASE);
  }
  if (compras.error) throw new Error(compras.error.message ?? 'No se pudieron leer los gastos.');

  const inyecciones = await traerTodo((desde, hasta) =>
    supabase
      .from('ci_inyecciones_capital')
      .select('id,fecha_ingreso,creado_al,monto_usd,origen_fondo,metodo_pago,soporte_storage_path')
      .eq('proyecto_id', proyectoId)
      .order('fecha_ingreso', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, hasta),
  );
  if (inyecciones.error && inyecciones.error.code !== '42P01') {
    throw new Error(inyecciones.error.message ?? 'No se pudieron leer los aportes.');
  }

  const movimientos: MovimientoRendicion[] = [];
  for (const r of compras.data) {
    const g = gastoDesdeCompra(r, pctPactado);
    if (g) movimientos.push(g);
  }
  for (const r of inyecciones.data) {
    const a = aporteDesdeInyeccion(r);
    if (a) movimientos.push(a);
  }
  return movimientos;
}

/** Obras cuyo histórico vive en registros_gastos: se lee del libro maestro. */
async function movimientosDesdeLibro(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<MovimientoRendicion[]> {
  const { filas } = await cargarLibroMaestro(supabase, { proyectoId, limit: 100000 });
  const movimientos: MovimientoRendicion[] = [];
  for (const f of filas) {
    if (f.clase !== 'GASTO' && f.clase !== 'INGRESO') continue;
    if (f.clase === 'GASTO' && esGastoAnulado(f.estado)) continue;
    movimientos.push({
      id: f.id,
      clase: f.clase,
      fecha: f.fecha,
      proveedor: f.proveedor,
      concepto: f.descripcion,
      factura: f.invoice_number,
      tipo: f.tipo,
      capitulo: f.capitulo,
      baseUsd: f.monto_base_usd,
      honorariosUsd: f.clase === 'GASTO' ? f.honorarios_usd : 0,
      honorariosGuardados: true,
      estado: f.estado,
      formaPago: f.forma_pago,
      tieneSoporte: f.tiene_documento,
    });
  }
  return movimientos;
}

export async function cargarRendicionHonorarios(
  supabase: SupabaseClient,
  params: { proyectoId: string; periodo: PeriodoRendicion; fecha: string },
): Promise<RendicionCargada | null> {
  const proyectoId = params.proyectoId.trim();
  const { data: proyecto, error } = await supabase
    .from('ci_proyectos')
    .select('*')
    .eq('id', proyectoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!proyecto) return null;

  const p = proyecto as Fila;
  const config = await obtenerConfigCco(supabase, proyectoId);
  let pctPactado = config.honorarios_admin_pct > 0 ? config.honorarios_admin_pct : 15;
  if (config.fuente_honorarios === 'default') {
    // Igual que el tablero: sin ajuste CCO, vale el % del contrato de administración delegada.
    const { data: contrato } = await supabase
      .from('ci_contratos_express')
      .select('honorarios_admin_pct')
      .eq('proyecto_id', proyectoId)
      .eq('tipo_contrato', TIPO_CONTRATO_AD)
      .eq('estado', ESTADO_CONTRATO_EXITOSO)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const pctContrato = num((contrato as Fila | null)?.honorarios_admin_pct);
    if (pctContrato > 0) pctPactado = pctContrato;
  }

  const movimientos = (await tieneRegistrosGastos(supabase, proyectoId))
    ? await movimientosDesdeLibro(supabase, proyectoId)
    : await movimientosDesdeCompras(supabase, proyectoId, pctPactado);

  const rendicion = construirRendicion({
    movimientos,
    rango: rangoRendicion(params.periodo, params.fecha),
    pctPactado,
  });
  await mejorarConceptos(supabase, rendicion.gastos);

  return {
    obra: config.obra_alias?.trim() || txt(p.nombre) || txt(p.nombre_proyecto) || 'Obra',
    cliente: txt(p.cliente) || null,
    empresa: config.empresa_nombre?.trim() || 'Casa Inteligente',
    proyectoId,
    rendicion,
  };
}
