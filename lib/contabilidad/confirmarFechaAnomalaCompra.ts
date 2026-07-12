import type { SupabaseClient } from '@supabase/supabase-js';
import {
  auditoriaFechaCompraAlmacenada,
  type AuditoriaFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import { updateContabilidadCompraRow } from '@/lib/contabilidad/updateContabilidadCompraRow';

type CompraFechaRow = {
  id: string;
  fecha: string;
  alerta_fecha?: 'advertencia' | 'critico' | null;
  fecha_confirmada_manual?: boolean | null;
};

export async function confirmarFechaAnomalaCompra(
  supabase: SupabaseClient,
  compraId: string,
): Promise<{ audit: AuditoriaFechaCompra; yaConfirmada?: boolean }> {
  const { data: compraRaw, error: loadErr } = await supabase
    .from('contabilidad_compras')
    .select('id,fecha,alerta_fecha,fecha_confirmada_manual')
    .eq('id', compraId)
    .maybeSingle();

  if (loadErr) throw new Error(loadErr.message);
  if (!compraRaw) throw new Error('Compra no encontrada');

  const compra = compraRaw as CompraFechaRow;
  if (compra.fecha_confirmada_manual) {
    const audit = auditoriaFechaCompraAlmacenada(
      String(compra.fecha ?? ''),
      compra.alerta_fecha,
    );
    return { audit, yaConfirmada: true };
  }

  const audit = auditoriaFechaCompraAlmacenada(
    String(compra.fecha ?? ''),
    compra.alerta_fecha,
  );
  if (audit.nivel !== 'critico' && audit.nivel !== 'advertencia') {
    throw new Error('Esta compra no tiene una fecha anómala pendiente de verificación.');
  }

  const patch = {
    fecha_confirmada_manual: true,
    alerta_fecha: audit.nivel,
  };

  const { error: upErr } = await updateContabilidadCompraRow(supabase, compraId, patch);

  if (upErr?.message?.includes('fecha_confirmada_manual')) {
    throw new Error('La verificación de fecha no está disponible en la base de datos.');
  }
  if (upErr) throw new Error(upErr.message);

  return { audit };
}
