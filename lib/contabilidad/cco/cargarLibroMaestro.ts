import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';
import {
  CCO_ORIGEN_HISTORICO,
  CCO_ORIGEN_V4,
  esIngresoLibroCcoV4,
  fetchAllRows,
} from '@/lib/contabilidad/cco/fetchAllRows';
import {
  gastoRegistroALibroFila,
  getGastosCCO,
  tieneRegistrosGastos,
} from '@/lib/contabilidad/cco/registrosGastos';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function cargarLibroMaestro(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    clase?: string | null;
    limit?: number;
    proveedor?: string | null;
    capitulo?: string | null;
  },
): Promise<{ filas: CcoLibroFila[]; total: number; fuente?: 'registros_gastos' | 'cco_fusion' }> {
  const proyectoId = params.proyectoId;
  const limit = params.limit ?? 50_000;
  const claseFiltro = params.clase?.trim().toUpperCase() || null;

  // Preferir histórico importado en registros_gastos (CSV RANCHO / ~2462 filas).
  if (await tieneRegistrosGastos(supabase)) {
    const { rows, total } = await getGastosCCO(supabase, {
      clase: claseFiltro,
      limit,
      proveedor: params.proveedor,
      capitulo: params.capitulo,
    });
    return {
      filas: rows.map(gastoRegistroALibroFila),
      total,
      fuente: 'registros_gastos',
    };
  }

  const filas: CcoLibroFila[] = [];

  const { data: cfg } = await supabase
    .from('cco_proyecto_config')
    .select('honorarios_admin_pct')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  const pctGlobal = num(cfg?.honorarios_admin_pct) || 15;

  let tieneLibroV4 = false;

  if (!claseFiltro || claseFiltro === 'GASTO') {
    const { data: compras, error } = await fetchAllRows<Record<string, unknown>>(
      () =>
        supabase
          .from('contabilidad_compras')
          .select(
            'id,fecha,supplier_name,notas,monto_usd,tipo_gasto_cco,capitulo_cco,subcapitulo_cco,honorarios_usd,admin_pct_override,cco_estado,contrato_obra_id,moneda_original,invoice_number,origen,origen_v4_id',
          )
          .eq('proyecto_id', proyectoId)
          .neq('imputacion', IMPUTACION_ENTIDAD)
          .neq('origen', CCO_ORIGEN_HISTORICO)
          .order('fecha', { ascending: false })
          .order('id', { ascending: false }),
      { maxRows: limit },
    );
    if (error && !/tipo_gasto_cco|capitulo_cco|origen|schema cache/i.test(error.message ?? '')) {
      throw error;
    }
    for (const row of compras ?? []) {
      const r = row as Record<string, unknown>;
      const origen = String(r.origen ?? '');
      if (origen === CCO_ORIGEN_HISTORICO) continue;
      if (origen === CCO_ORIGEN_V4 || r.origen_v4_id != null) tieneLibroV4 = true;
      const base = num(r.monto_usd);
      const tipo =
        String(r.tipo_gasto_cco ?? '').trim() ||
        clasificarTipoGasto(String(r.supplier_name ?? ''));
      const calc = aplicarHonorariosABase(base, num(r.admin_pct_override) || null, pctGlobal);
      const honorarios = r.honorarios_usd != null ? num(r.honorarios_usd) : calc.honorariosUsd;
      filas.push({
        id: String(r.id),
        clase: 'GASTO',
        fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
        proveedor: String(r.supplier_name ?? '').trim() || 'Sin proveedor',
        tipo,
        capitulo: String(r.capitulo_cco ?? '').trim() || '—',
        subcapitulo: String(r.subcapitulo_cco ?? '').trim() || '—',
        descripcion:
          String(r.notas ?? '').trim() ||
          String(r.invoice_number ?? '').trim() ||
          'Gasto',
        moneda: String(r.moneda_original ?? 'USD'),
        monto_base_usd: base,
        honorarios_usd: honorarios,
        costo_total_usd: base + honorarios,
        estado: String(r.cco_estado ?? 'PAGADO'),
        contrato_obra_id: r.contrato_obra_id != null ? String(r.contrato_obra_id) : null,
        fuente: 'compra',
      });
    }
  } else {
    const { count } = await supabase
      .from('contabilidad_compras')
      .select('id', { count: 'exact', head: true })
      .eq('proyecto_id', proyectoId)
      .eq('origen', CCO_ORIGEN_V4);
    tieneLibroV4 = (count ?? 0) > 0;
  }

  if (!claseFiltro || claseFiltro === 'INGRESO') {
    const { data: iny, error } = await fetchAllRows<Record<string, unknown>>(
      () =>
        supabase
          .from('ci_inyecciones_capital')
          .select(
            'id,fecha_ingreso,creado_al,monto_usd,metodo_pago,origen_fondo,moneda_recibida,creado_por,banco_origen',
          )
          .eq('proyecto_id', proyectoId)
          .order('fecha_ingreso', { ascending: false })
          .order('id', { ascending: false }),
      { maxRows: limit },
    );
    if (error && error.code !== '42P01') throw error;
    for (const row of iny ?? []) {
      const r = row as Record<string, unknown>;
      if (
        tieneLibroV4 &&
        !esIngresoLibroCcoV4({
          creado_por: r.creado_por as string | null,
          origen_fondo: r.origen_fondo as string | null,
          banco_origen: r.banco_origen as string | null,
        })
      ) {
        continue;
      }
      const base = num(r.monto_usd);
      filas.push({
        id: String(r.id),
        clase: 'INGRESO',
        fecha: String(r.fecha_ingreso ?? r.creado_al ?? '').slice(0, 10) || null,
        proveedor: 'CLIENTE',
        tipo: 'INGRESO',
        capitulo: '—',
        subcapitulo: '—',
        descripcion:
          String(r.origen_fondo ?? r.metodo_pago ?? 'Inyección').trim() || 'Inyección',
        moneda: String(r.moneda_recibida ?? 'USD'),
        monto_base_usd: base,
        honorarios_usd: 0,
        costo_total_usd: base,
        estado: 'REGISTRADO',
        contrato_obra_id: null,
        fuente: 'inyeccion',
      });
    }
  }

  if (!claseFiltro || claseFiltro === 'CONTRATO') {
    const { data: contratos, error } = await fetchAllRows<Record<string, unknown>>(
      () =>
        supabase
          .from('cco_contratos_obra')
          .select('*')
          .eq('proyecto_id', proyectoId)
          .order('fecha', { ascending: false })
          .order('id', { ascending: false }),
      { maxRows: limit },
    );
    if (error && !/cco_contratos_obra|schema cache/i.test(error.message ?? '')) throw error;
    for (const row of contratos ?? []) {
      const r = row as Record<string, unknown>;
      filas.push({
        id: String(r.id),
        clase: 'CONTRATO',
        fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
        proveedor: String(r.proveedor ?? ''),
        tipo: String(r.tipo_gasto_cco ?? 'CONTRATO'),
        capitulo: '—',
        subcapitulo: '—',
        descripcion: String(r.descripcion ?? ''),
        moneda: String(r.moneda ?? 'USD'),
        monto_base_usd: num(r.monto_base_usd),
        honorarios_usd: num(r.honorarios_usd),
        costo_total_usd: num(r.costo_total_usd),
        estado: String(r.estado ?? 'PENDIENTE'),
        contrato_obra_id: String(r.id),
        fuente: 'contrato',
      });
    }
  }

  if (!claseFiltro || claseFiltro === 'PRESUPUESTO') {
    const { data: presup, error } = await fetchAllRows<Record<string, unknown>>(
      () =>
        supabase
          .from('cco_presupuestos_capitulo')
          .select('*')
          .eq('proyecto_id', proyectoId)
          .order('capitulo'),
      { maxRows: limit },
    );
    if (error && !/cco_presupuestos|schema cache/i.test(error.message ?? '')) throw error;
    for (const row of presup ?? []) {
      const r = row as Record<string, unknown>;
      const est = num(r.estimado_usd);
      filas.push({
        id: String(r.id),
        clase: 'PRESUPUESTO',
        fecha: null,
        proveedor: '—',
        tipo: 'PRESUPUESTO',
        capitulo: String(r.capitulo ?? ''),
        subcapitulo: String(r.subcapitulo ?? '—'),
        descripcion: String(r.descripcion ?? r.capitulo ?? ''),
        moneda: 'USD',
        monto_base_usd: est,
        honorarios_usd: 0,
        costo_total_usd: est,
        estado: 'ESTIMADO',
        contrato_obra_id: null,
        fuente: 'presupuesto',
      });
    }
  }

  filas.sort((a, b) => {
    const fa = a.fecha ?? '';
    const fb = b.fecha ?? '';
    if (fa !== fb) return fb.localeCompare(fa);
    return a.clase.localeCompare(b.clase);
  });

  return { filas: filas.slice(0, limit), total: filas.length, fuente: 'cco_fusion' };
}
