import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import {
  claveGastoDividido,
  parsePctDistribucion,
} from '@/lib/contabilidad/cco/egresosVista';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function resolverTasa(r: Record<string, unknown>, moneda: string, montoUsd: number): number {
  const tasaBcv = num(r.tasa_bcv_ves_por_usd);
  if (tasaBcv > 0) return tasaBcv;
  const montoVes = num(r.monto_ves);
  if (montoUsd > 0 && montoVes > 0) return montoVes / montoUsd;
  const binance = num(r.tasa_binance);
  if (binance > 0) return binance;
  return moneda === 'VES' ? 1 : 0;
}

function resolverMontoOrig(
  r: Record<string, unknown>,
  moneda: string,
  montoUsd: number,
  tasa: number,
): number {
  const montoVes = num(r.monto_ves);
  if (moneda === 'VES') {
    if (montoVes > 0) return montoVes;
    if (tasa > 0) return montoUsd * tasa;
    return montoUsd;
  }
  return montoUsd;
}

export async function cargarLibroMaestro(
  supabase: SupabaseClient,
  params: { proyectoId: string; clase?: string | null; limit?: number },
): Promise<{ filas: CcoLibroFila[]; total: number; honorarios_admin_pct: number }> {
  const proyectoId = params.proyectoId;
  const limit = params.limit ?? 2000;
  const claseFiltro = params.clase?.trim().toUpperCase() || null;
  const filas: CcoLibroFila[] = [];

  const { data: cfg } = await supabase
    .from('cco_proyecto_config')
    .select('honorarios_admin_pct')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  const pctGlobal = num(cfg?.honorarios_admin_pct) || 15;

  if (!claseFiltro || claseFiltro === 'GASTO') {
    const { data: compras, error } = await supabase
      .from('contabilidad_compras')
      .select(
        [
          'id',
          'fecha',
          'supplier_name',
          'notas',
          'monto_usd',
          'monto_ves',
          'tasa_bcv_ves_por_usd',
          'tasa_binance',
          'tipo_gasto_cco',
          'capitulo_cco',
          'subcapitulo_cco',
          'honorarios_usd',
          'admin_pct_override',
          'cco_estado',
          'contrato_obra_id',
          'moneda_original',
          'invoice_number',
          'origen_v4_id',
          'forma_pago_cco',
        ].join(','),
      )
      .eq('proyecto_id', proyectoId)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .order('fecha', { ascending: false })
      .limit(limit);
    if (error && !/tipo_gasto_cco|capitulo_cco|schema cache|origen_v4/i.test(error.message ?? '')) {
      throw error;
    }
    for (const row of compras ?? []) {
      const r = row as unknown as Record<string, unknown>;
      const base = num(r.monto_usd);
      const tipo =
        String(r.tipo_gasto_cco ?? '').trim() ||
        clasificarTipoGasto(String(r.supplier_name ?? ''));
      const calc = aplicarHonorariosABase(base, num(r.admin_pct_override) || null, pctGlobal);
      const honorarios = r.honorarios_usd != null ? num(r.honorarios_usd) : calc.honorariosUsd;
      const moneda = String(r.moneda_original ?? 'USD').toUpperCase() || 'USD';
      const tasa = resolverTasa(r, moneda, base);
      const descripcion =
        String(r.notas ?? '').trim() ||
        String(r.invoice_number ?? '').trim() ||
        'Gasto';
      const pctDist = parsePctDistribucion(descripcion) ?? 100;
      const invoice = String(r.invoice_number ?? '').trim() || null;
      const origenV4 = r.origen_v4_id != null ? num(r.origen_v4_id) : null;
      const proveedor = String(r.supplier_name ?? '').trim() || 'Sin proveedor';
      const fecha = r.fecha != null ? String(r.fecha).slice(0, 10) : null;
      filas.push({
        id: String(r.id),
        display_id: origenV4 && origenV4 > 0 ? origenV4 : String(r.id).slice(0, 8),
        origen_v4_id: origenV4 && origenV4 > 0 ? origenV4 : null,
        clase: 'GASTO',
        fecha,
        proveedor,
        tipo,
        capitulo: String(r.capitulo_cco ?? '').trim() || '—',
        subcapitulo: String(r.subcapitulo_cco ?? '').trim() || '—',
        descripcion,
        moneda,
        tasa,
        monto_orig: resolverMontoOrig(r, moneda, base, tasa),
        pct_distribucion: pctDist,
        admin_pct: calc.adminPct,
        monto_base_usd: base,
        honorarios_usd: honorarios,
        costo_total_usd: base + honorarios,
        estado: String(r.cco_estado ?? 'PAGADO'),
        forma_pago: r.forma_pago_cco != null ? String(r.forma_pago_cco) : null,
        invoice_number: invoice,
        split_group_key: claveGastoDividido({
          invoice_number: invoice,
          fecha,
          proveedor,
          descripcion,
        }),
        contrato_obra_id: r.contrato_obra_id != null ? String(r.contrato_obra_id) : null,
        fuente: 'compra',
      });
    }
  }

  if (!claseFiltro || claseFiltro === 'INGRESO') {
    const { data: iny, error } = await supabase
      .from('ci_inyecciones_capital')
      .select(
        'id,fecha_ingreso,creado_al,monto_usd,monto_ves,tasa_bcv,tasa_aplicada,metodo_pago,origen_fondo,moneda_recibida',
      )
      .eq('proyecto_id', proyectoId)
      .order('fecha_ingreso', { ascending: false })
      .limit(limit);
    if (error && error.code !== '42P01') throw error;
    for (const row of iny ?? []) {
      const r = row as Record<string, unknown>;
      const base = num(r.monto_usd);
      const moneda = String(r.moneda_recibida ?? 'USD').toUpperCase() || 'USD';
      const tasa = num(r.tasa_aplicada) || num(r.tasa_bcv) || 0;
      const montoVes = num(r.monto_ves);
      filas.push({
        id: String(r.id),
        display_id: String(r.id).slice(0, 8),
        origen_v4_id: null,
        clase: 'INGRESO',
        fecha: String(r.fecha_ingreso ?? r.creado_al ?? '').slice(0, 10) || null,
        proveedor: 'CLIENTE',
        tipo: 'INGRESO',
        capitulo: '—',
        subcapitulo: '—',
        descripcion:
          String(r.origen_fondo ?? r.metodo_pago ?? 'Inyección').trim() || 'Inyección',
        moneda,
        tasa,
        monto_orig: moneda === 'VES' && montoVes > 0 ? montoVes : base,
        pct_distribucion: 100,
        admin_pct: 0,
        monto_base_usd: base,
        honorarios_usd: 0,
        costo_total_usd: base,
        estado: 'REGISTRADO',
        forma_pago: r.metodo_pago != null ? String(r.metodo_pago) : null,
        invoice_number: null,
        split_group_key: null,
        contrato_obra_id: null,
        fuente: 'inyeccion',
      });
    }
  }

  if (!claseFiltro || claseFiltro === 'CONTRATO') {
    const { data: contratos, error } = await supabase
      .from('cco_contratos_obra')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('fecha', { ascending: false })
      .limit(limit);
    if (error && !/cco_contratos_obra|schema cache/i.test(error.message ?? '')) throw error;
    for (const row of contratos ?? []) {
      const r = row as Record<string, unknown>;
      const origenV4 = r.origen_v4_id != null ? num(r.origen_v4_id) : null;
      const base = num(r.monto_base_usd);
      filas.push({
        id: String(r.id),
        display_id: origenV4 && origenV4 > 0 ? origenV4 : String(r.id).slice(0, 8),
        origen_v4_id: origenV4 && origenV4 > 0 ? origenV4 : null,
        clase: 'CONTRATO',
        fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
        proveedor: String(r.proveedor ?? ''),
        tipo: String(r.tipo_gasto_cco ?? 'CONTRATO'),
        capitulo: '—',
        subcapitulo: '—',
        descripcion: String(r.descripcion ?? ''),
        moneda: String(r.moneda ?? 'USD'),
        tasa: 0,
        monto_orig: base,
        pct_distribucion: 100,
        admin_pct: num(r.admin_pct) || pctGlobal,
        monto_base_usd: base,
        honorarios_usd: num(r.honorarios_usd),
        costo_total_usd: num(r.costo_total_usd),
        estado: String(r.estado ?? 'PENDIENTE'),
        forma_pago: null,
        invoice_number: null,
        split_group_key: null,
        contrato_obra_id: String(r.id),
        fuente: 'contrato',
      });
    }
  }

  if (!claseFiltro || claseFiltro === 'PRESUPUESTO') {
    const { data: presup, error } = await supabase
      .from('cco_presupuestos_capitulo')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('capitulo')
      .limit(limit);
    if (error && !/cco_presupuestos|schema cache/i.test(error.message ?? '')) throw error;
    for (const row of presup ?? []) {
      const r = row as Record<string, unknown>;
      const est = num(r.estimado_usd);
      const origenV4 = r.origen_v4_id != null ? num(r.origen_v4_id) : null;
      filas.push({
        id: String(r.id),
        display_id: origenV4 && origenV4 > 0 ? origenV4 : String(r.id).slice(0, 8),
        origen_v4_id: origenV4 && origenV4 > 0 ? origenV4 : null,
        clase: 'PRESUPUESTO',
        fecha: null,
        proveedor: '—',
        tipo: 'PRESUPUESTO',
        capitulo: String(r.capitulo ?? ''),
        subcapitulo: String(r.subcapitulo ?? '—'),
        descripcion: String(r.descripcion ?? r.capitulo ?? ''),
        moneda: 'USD',
        tasa: 0,
        monto_orig: est,
        pct_distribucion: 100,
        admin_pct: 0,
        monto_base_usd: est,
        honorarios_usd: 0,
        costo_total_usd: est,
        estado: 'ESTIMADO',
        forma_pago: null,
        invoice_number: null,
        split_group_key: null,
        contrato_obra_id: null,
        fuente: 'presupuesto',
      });
    }
  }

  filas.sort((a, b) => {
    const fa = a.fecha ?? '';
    const fb = b.fecha ?? '';
    if (fa !== fb) return fb.localeCompare(fa);
    const ida = typeof a.display_id === 'number' ? a.display_id : 0;
    const idb = typeof b.display_id === 'number' ? b.display_id : 0;
    if (ida !== idb) return idb - ida;
    return a.clase.localeCompare(b.clase);
  });

  return { filas: filas.slice(0, limit), total: filas.length, honorarios_admin_pct: pctGlobal };
}
