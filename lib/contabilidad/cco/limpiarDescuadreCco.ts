/**
 * Higiene CCO: quita auditoría mal importada como gasto, deduplica gemelos
 * (mismo día/proveedor/monto/concepto) y normaliza devaluación brecha→V4.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';
import { normalizarDevaluacionConfig } from '@/lib/contabilidad/cco/tasas';

export type LimpiezaDescuadreResult = {
  auditoriaEliminada: number;
  duplicadosEliminados: number;
  devaluacionAntes: number | null;
  devaluacionDespues: number | null;
  devaluacionCorregida: boolean;
  idsEliminados: string[];
  errores: string[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normTexto(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function claveDuplicado(r: {
  fecha?: string | null;
  supplier_name?: string | null;
  monto_usd?: number | null;
  notas?: string | null;
  invoice_number?: string | null;
}): string {
  const fecha = String(r.fecha ?? '').slice(0, 10);
  const prov = normTexto(String(r.supplier_name ?? ''));
  const monto = Math.round(num(r.monto_usd) * 100) / 100;
  const notas = normTexto(String(r.notas ?? ''))
    .replace(/^CCO-V4-\d+\s*/, '')
    .slice(0, 80);
  // No usar invoice SIN-* (suelen diferir entre gemelos del mismo CSV).
  const inv = String(r.invoice_number ?? '').trim().toUpperCase();
  const invKey = inv.startsWith('CCO-V4-') ? inv : '';
  return `${fecha}|${prov}|${monto}|${notas}|${invKey}`;
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
        'id,fecha,supplier_name,notas,invoice_number,monto_usd,origen,origen_v4_id,created_at,purchase_invoice_id',
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
    devaluacionAntes: null,
    devaluacionDespues: null,
    devaluacionCorregida: false,
    idsEliminados: [],
    errores: [],
  };

  const compras = await fetchAllComprasProyecto(supabase, proyectoId);

  const idsAuditoria: string[] = [];
  for (const r of compras) {
    const notas = r.notas != null ? String(r.notas) : '';
    const invoice = r.invoice_number != null ? String(r.invoice_number) : '';
    const esAudit =
      esDescripcionAuditoriaCco(notas) ||
      esCompraSoloAuditoriaCco({
        supplier_name: r.supplier_name != null ? String(r.supplier_name) : null,
        notas,
        invoice_number: invoice,
        lineas: notas ? [{ descripcion: notas }] : [],
      });
    // No tocar compras con factura de procurement real.
    if (esAudit && !r.purchase_invoice_id) {
      idsAuditoria.push(String(r.id));
    }
  }

  const auditSet = new Set(idsAuditoria);
  const vivos = compras.filter((r) => !auditSet.has(String(r.id)));

  // Dedup: conservar la que tenga origen_v4_id / CCO-V4; si empatan, la más antigua.
  const grupos = new Map<string, Record<string, unknown>[]>();
  for (const r of vivos) {
    if (num(r.monto_usd) <= 0) continue;
    const k = claveDuplicado({
      fecha: r.fecha != null ? String(r.fecha) : null,
      supplier_name: r.supplier_name != null ? String(r.supplier_name) : null,
      monto_usd: num(r.monto_usd),
      notas: r.notas != null ? String(r.notas) : null,
      invoice_number: r.invoice_number != null ? String(r.invoice_number) : null,
    });
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(r);
  }

  const idsDup: string[] = [];
  for (const group of Array.from(grupos.values())) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) => {
      const aV4 = a.origen_v4_id != null ? 1 : 0;
      const bV4 = b.origen_v4_id != null ? 1 : 0;
      if (bV4 !== aV4) return bV4 - aV4;
      const aInv = String(a.invoice_number ?? '').toUpperCase().startsWith('CCO-V4-') ? 1 : 0;
      const bInv = String(b.invoice_number ?? '').toUpperCase().startsWith('CCO-V4-') ? 1 : 0;
      if (bInv !== aInv) return bInv - aInv;
      return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
    });
    for (const drop of ranked.slice(1)) {
      // No borrar si tiene purchase_invoice_id (Telegram/procurement).
      if (drop.purchase_invoice_id) continue;
      idsDup.push(String(drop.id));
    }
  }

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

  return result;
}
