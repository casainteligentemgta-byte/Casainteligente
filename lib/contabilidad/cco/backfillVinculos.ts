import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolverContratoVinculadoDetalle,
  type ContratoCandidato,
} from '@/lib/contabilidad/cco/vincularContrato';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Re-enlaza pagos CONTRATISTA/CONTRATO huérfanos a contratos del mismo proveedor.
 */
export async function backfillVinculosContratos(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: { umbral?: number; dryRun?: boolean; limit?: number },
): Promise<{
  revisados: number;
  vinculados: number;
  sinMatch: number;
  detalle: { compra_id: string; contrato_id: string; score: number; motivo: string }[];
}> {
  const umbral = opts?.umbral ?? 40;
  const dryRun = Boolean(opts?.dryRun);
  const limit = opts?.limit ?? 3000;

  const { data: contratosRows, error: cErr } = await supabase
    .from('cco_contratos_obra')
    .select('id,proveedor,descripcion')
    .eq('proyecto_id', proyectoId);
  if (cErr) throw cErr;

  const candidatos: ContratoCandidato[] = (contratosRows ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    proveedor: String((r as { proveedor?: string }).proveedor ?? ''),
    descripcion: String((r as { descripcion?: string }).descripcion ?? ''),
  }));

  const { data: huerfanos, error: hErr } = await supabase
    .from('contabilidad_compras')
    .select('id,supplier_name,notas,invoice_number,tipo_gasto_cco,monto_usd')
    .eq('proyecto_id', proyectoId)
    .is('contrato_obra_id', null)
    .or('tipo_gasto_cco.eq.CONTRATISTA,tipo_gasto_cco.eq.CONTRATO')
    .order('fecha', { ascending: true })
    .limit(limit);
  if (hErr) throw hErr;

  const detalle: { compra_id: string; contrato_id: string; score: number; motivo: string }[] = [];
  let vinculados = 0;
  let sinMatch = 0;

  for (const row of huerfanos ?? []) {
    const r = row as Record<string, unknown>;
    const compraId = String(r.id);
    const proveedor = String(r.supplier_name ?? '').trim();
    const descripcion =
      String(r.notas ?? '').trim() || String(r.invoice_number ?? '').trim() || '';
    const hit = resolverContratoVinculadoDetalle({
      proveedor,
      descripcion,
      contratos: candidatos,
      umbral,
    });
    if (!hit) {
      sinMatch += 1;
      continue;
    }
    detalle.push({
      compra_id: compraId,
      contrato_id: hit.contrato.id,
      score: hit.score,
      motivo: hit.motivo,
    });
    if (!dryRun) {
      const { error } = await supabase
        .from('contabilidad_compras')
        .update({
          contrato_obra_id: hit.contrato.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', compraId);
      if (error) throw error;
    }
    vinculados += 1;
    void num(r.monto_usd);
  }

  if (!dryRun && vinculados > 0) {
    await supabase.from('cco_auditoria_eventos').insert({
      proyecto_id: proyectoId,
      accion: 'BACKFILL VINCULOS CONTRATO',
      detalle: `Vinculó ${vinculados} pago(s) huérfano(s) a contrato (de ${(huerfanos ?? []).length} revisados · umbral ${umbral}${sinMatch ? ` · ${sinMatch} sin match` : ''})`,
      actor: 'sistema',
      metadata: { vinculados, sinMatch, umbral, revisados: (huerfanos ?? []).length },
    });
  }

  return {
    revisados: (huerfanos ?? []).length,
    vinculados,
    sinMatch,
    detalle: detalle.slice(0, 100),
  };
}
