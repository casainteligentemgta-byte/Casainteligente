import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function cargarLibroMaestro(
  supabase: SupabaseClient,
  params: { proyectoId: string; clase?: string | null; limit?: number },
): Promise<{ filas: CcoLibroFila[]; total: number }> {
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
        'id,fecha,supplier_name,notas,monto_usd,tipo_gasto_cco,capitulo_cco,subcapitulo_cco,honorarios_usd,admin_pct_override,cco_estado,contrato_obra_id,moneda_original,invoice_number',
      )
      .eq('proyecto_id', proyectoId)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .order('fecha', { ascending: false })
      .limit(limit);
    if (error && !/tipo_gasto_cco|capitulo_cco|schema cache/i.test(error.message ?? '')) {
      throw error;
    }
    for (const row of compras ?? []) {
      const r = row as Record<string, unknown>;
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
  }

  if (!claseFiltro || claseFiltro === 'INGRESO') {
    const { data: iny, error } = await supabase
      .from('ci_inyecciones_capital')
      .select('id,fecha_ingreso,creado_al,monto_usd,metodo_pago,origen_fondo,moneda_recibida')
      .eq('proyecto_id', proyectoId)
      .order('fecha_ingreso', { ascending: false })
      .limit(limit);
    if (error && error.code !== '42P01') throw error;
    for (const row of iny ?? []) {
      const r = row as Record<string, unknown>;
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
    const { data: contratos, error } = await supabase
      .from('cco_contratos_obra')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('fecha', { ascending: false })
      .limit(limit);
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

  return { filas: filas.slice(0, limit), total: filas.length };
}
