/**
 * Higiene CCO: quita auditoría mal importada como gasto, deduplica gemelos
 * (fila suelta o egreso agrupado / dividido) y normaliza devaluación brecha→V4.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';
import {
  detectarParesGastosGemelos,
  type GastoGemeloPar,
} from '@/lib/contabilidad/cco/detectarGastosGemelos';
import { normalizarDevaluacionConfig } from '@/lib/contabilidad/cco/tasas';
import { idsIngresosGemelosAEliminar } from '@/lib/contabilidad/cco/dedupeIngresosGemelos';

export type { GastoGemeloPar };

export type LimpiezaDescuadreResult = {
  auditoriaEliminada: number;
  duplicadosEliminados: number;
  ingresosGemelosEliminados: number;
  devaluacionAntes: number | null;
  devaluacionDespues: number | null;
  devaluacionCorregida: boolean;
  idsEliminados: string[];
  /** Pares gemelos detectados (dry-run o tras marcar a borrar). */
  gastosGemelos: GastoGemeloPar[];
  errores: string[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchAllComprasProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const all: Record<string, unknown>[] = [];
  let from = 0;
  for (let guard = 0; guard < 60; guard += 1) {
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .select(
        'id,fecha,supplier_name,notas,invoice_number,monto_usd,origen,origen_v4_id,created_at,purchase_invoice_id,contabilidad_compra_lineas(descripcion)',
      )
      .eq('proyecto_id', proyectoId)
      .order('fecha', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function lineasDescDesdeCompra(r: Record<string, unknown>): Array<{ descripcion: string }> {
  const raw = r.contabilidad_compra_lineas;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr
    .map((l) => ({
      descripcion: String((l as { descripcion?: string | null }).descripcion ?? ''),
    }))
    .filter((l) => l.descripcion.trim());
}

async function borrarCompraContableSuave(
  supabase: SupabaseClient,
  compraId: string,
): Promise<void> {
  await supabase.from('contabilidad_compra_lineas').delete().eq('compra_id', compraId);
  const { error } = await supabase.from('contabilidad_compras').delete().eq('id', compraId);
  if (error) throw error;
}

export async function limpiarDescuadreCco(
  supabase: SupabaseClient,
  opts: { proyectoId: string; dryRun?: boolean },
): Promise<LimpiezaDescuadreResult> {
  const proyectoId = opts.proyectoId.trim();
  const dryRun = Boolean(opts.dryRun);
  const result: LimpiezaDescuadreResult = {
    auditoriaEliminada: 0,
    duplicadosEliminados: 0,
    ingresosGemelosEliminados: 0,
    devaluacionAntes: null,
    devaluacionDespues: null,
    devaluacionCorregida: false,
    idsEliminados: [],
    gastosGemelos: [],
    errores: [],
  };

  const compras = await fetchAllComprasProyecto(supabase, proyectoId);

  const idsAuditoria: string[] = [];
  for (const r of compras) {
    const notas = r.notas != null ? String(r.notas) : '';
    const invoice = r.invoice_number != null ? String(r.invoice_number) : '';
    const lineas = lineasDescDesdeCompra(r);
    // Si no hay líneas embed, usar notas solo si parecen log (no nota genérica de import).
    const lineasParaFiltro =
      lineas.length > 0
        ? lineas
        : notas && esDescripcionAuditoriaCco(notas)
          ? [{ descripcion: notas }]
          : [];
    const esAudit = esCompraSoloAuditoriaCco({
      supplier_name: r.supplier_name != null ? String(r.supplier_name) : null,
      notas,
      invoice_number: invoice,
      lineas: lineasParaFiltro,
    });
    // No tocar compras con factura de procurement real.
    if (esAudit && !r.purchase_invoice_id) {
      idsAuditoria.push(String(r.id));
    }
  }

  const auditSet = new Set(idsAuditoria);
  const vivos = compras.filter((r) => !auditSet.has(String(r.id)));

  // Dedup a nivel unidad (fila suelta o egreso agrupado / split), como en Egresos → Agrupar.
  const pares = detectarParesGastosGemelos(
    vivos.map((r) => ({
      id: String(r.id),
      fecha: r.fecha != null ? String(r.fecha) : null,
      supplier_name: r.supplier_name != null ? String(r.supplier_name) : null,
      notas: r.notas != null ? String(r.notas) : null,
      descripcion: r.notas != null ? String(r.notas) : null,
      invoice_number: r.invoice_number != null ? String(r.invoice_number) : null,
      monto_usd: num(r.monto_usd),
      origen_v4_id: r.origen_v4_id as string | number | null | undefined,
      created_at: r.created_at != null ? String(r.created_at) : null,
      purchase_invoice_id: r.purchase_invoice_id != null ? String(r.purchase_invoice_id) : null,
    })),
  );
  result.gastosGemelos = pares;
  const idsDup = Array.from(new Set(pares.flatMap((p) => p.eliminarIds)));

  const aBorrar = Array.from(new Set([...idsAuditoria, ...idsDup]));
  if (!dryRun) {
    for (const id of aBorrar) {
      try {
        await borrarCompraContableSuave(supabase, id);
        result.idsEliminados.push(id);
        if (auditSet.has(id)) result.auditoriaEliminada += 1;
        else result.duplicadosEliminados += 1;
      } catch (e) {
        result.errores.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } else {
    result.auditoriaEliminada = idsAuditoria.length;
    result.duplicadosEliminados = idsDup.length;
    result.idsEliminados = aBorrar;
  }

  const { data: cfg } = await supabase
    .from('cco_proyecto_config')
    .select('devaluacion_pct,honorarios_admin_pct')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();

  const devalAntes =
    cfg && (cfg as { devaluacion_pct?: number }).devaluacion_pct != null
      ? num((cfg as { devaluacion_pct?: number }).devaluacion_pct)
      : null;
  result.devaluacionAntes = devalAntes;

  if (devalAntes != null) {
    const devalNorm = normalizarDevaluacionConfig(devalAntes);
    result.devaluacionDespues = devalNorm;
    if (Math.abs(devalNorm - devalAntes) > 0.00001) {
      result.devaluacionCorregida = true;
      if (!dryRun) {
        const { error } = await supabase
          .from('cco_proyecto_config')
          .update({
            devaluacion_pct: devalNorm,
            updated_at: new Date().toISOString(),
          })
          .eq('proyecto_id', proyectoId);
        if (error) result.errores.push(`devaluacion: ${error.message}`);
      }
    }
  }

  // Ingresos gemelos (mismo abono/fecha/monto; uno con operador LUIS y otro limpio)
  try {
    const pageSize = 1000;
    const inyecciones: Array<{
      id: string;
      fecha_ingreso?: string | null;
      monto_usd?: number | null;
      origen_fondo?: string | null;
      creado_al?: string | null;
    }> = [];
    let from = 0;
    for (let guard = 0; guard < 40; guard += 1) {
      const { data, error } = await supabase
        .from('ci_inyecciones_capital')
        .select('id,fecha_ingreso,monto_usd,origen_fondo,creado_al')
        .eq('proyecto_id', proyectoId)
        .eq('creado_por', 'cco_v4_import')
        .order('fecha_ingreso', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = data ?? [];
      inyecciones.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    const idsIngresos = idsIngresosGemelosAEliminar(inyecciones);
    if (dryRun) {
      result.ingresosGemelosEliminados = idsIngresos.length;
      result.idsEliminados.push(...idsIngresos);
    } else {
      for (const id of idsIngresos) {
        const { error } = await supabase.from('ci_inyecciones_capital').delete().eq('id', id);
        if (error) result.errores.push(`ingreso gemelo ${id}: ${error.message}`);
        else {
          result.ingresosGemelosEliminados += 1;
          result.idsEliminados.push(id);
        }
      }
    }
  } catch (e) {
    result.errores.push(
      `ingresos gemelos: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return result;
}
