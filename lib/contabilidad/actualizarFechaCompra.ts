import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarAlertasConfig, umbralesFechaDesdeConfig } from '@/lib/alertas/alertasConfig';
import {
  auditoriaFechaCompra,
  fechaAnomalaRequiereAtencion,
  FechaCompraAnomalaError,
  type AuditoriaFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import { monedaOriginalCompra } from '@/lib/contabilidad/monedaCompra';
import { updateContabilidadCompraRow } from '@/lib/contabilidad/updateContabilidadCompraRow';

type CompraFechaRow = {
  id: string;
  fecha: string;
  total_amount: number;
  moneda: string | null;
  moneda_original: string | null;
  tasa_bcv_ves_por_usd: number | null;
};

export type ActualizarFechaCompraResult = {
  audit: AuditoriaFechaCompra;
  compraId: string;
  fecha: string;
  tasaBcv: number;
  fechaCambio: boolean;
};

export async function actualizarFechaCompra(
  supabase: SupabaseClient,
  compraId: string,
  fechaNueva: string,
  opts?: { confirmarFechaAnomala?: boolean },
): Promise<ActualizarFechaCompraResult> {
  const fecha = String(fechaNueva ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('Indique una fecha válida (AAAA-MM-DD).');
  }

  const { data: compraRaw, error: loadErr } = await supabase
    .from('contabilidad_compras')
    .select('id,fecha,total_amount,moneda,moneda_original,tasa_bcv_ves_por_usd')
    .eq('id', compraId)
    .maybeSingle();

  if (loadErr) throw new Error(loadErr.message);
  if (!compraRaw) throw new Error('Compra no encontrada');

  const compra = compraRaw as CompraFechaRow;
  const fechaAnterior = String(compra.fecha ?? '').slice(0, 10);
  const { config: alertas } = await cargarAlertasConfig(supabase);
  const umbrales = umbralesFechaDesdeConfig(alertas);
  const audit = auditoriaFechaCompra(fecha, new Date(), umbrales);

  if (fechaAnomalaRequiereAtencion(audit.nivel) && !opts?.confirmarFechaAnomala) {
    throw new FechaCompraAnomalaError(audit);
  }

  const montoTotal = Number(compra.total_amount) || 0;
  const montos = await resolverMontosCompraBimonetario({
    montoTotal,
    moneda: monedaOriginalCompra(compra),
    fecha,
    tasaBcvDigitada: null,
  });

  const patch: Record<string, unknown> = {
    fecha,
    ...payloadCompraBimonetario(montos),
    alerta_fecha: audit.nivel === 'ok' ? null : audit.nivel,
    fecha_confirmada_manual: fechaAnomalaRequiereAtencion(audit.nivel)
      ? Boolean(opts?.confirmarFechaAnomala)
      : false,
  };

  const { error: upErr } = await updateContabilidadCompraRow(supabase, compraId, patch);

  if (upErr?.message?.includes('alerta_fecha') || upErr?.message?.includes('fecha_confirmada_manual')) {
    const { fecha: _f, alerta_fecha: _a, fecha_confirmada_manual: _c, ...sinAuditoria } = patch;
    const { error: retryErr } = await updateContabilidadCompraRow(supabase, compraId, sinAuditoria);
    if (retryErr) throw new Error(retryErr.message);
  } else if (upErr) {
    throw new Error(upErr.message);
  }

  return {
    audit,
    compraId,
    fecha,
    tasaBcv: montos.tasaApplied,
    fechaCambio: fecha !== fechaAnterior,
  };
}
