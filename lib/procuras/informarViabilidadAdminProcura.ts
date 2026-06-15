import type { SupabaseClient } from '@supabase/supabase-js';
import { transicionEstadoProcuraValida } from '@/lib/procuras/procuraEstados';
import { enviarAlertaPmTrasViabilidadAdmin } from '@/lib/procuras/viabilidadAdminProcuraTelegram';

export type InformarViabilidadAdminResult = {
  ok: boolean;
  ticket?: string;
  error?: string;
  pmsNotificados?: number;
};

/** Administrador informa viabilidad presupuestaria → pendiente_pm + alerta al PM. */
export async function informarViabilidadAdminProcura(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    viabilidad: 'si' | 'no';
    adminNombre: string;
    adminTelegramId?: number | null;
  },
): Promise<InformarViabilidadAdminResult> {
  const procuraId = params.procuraId.trim();
  if (!procuraId) return { ok: false, error: 'Id de procura inválido.' };

  const { data: row, error: loadErr } = await supabase
    .from('ci_procuras')
    .select('id,ticket,estado')
    .eq('id', procuraId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!row) return { ok: false, error: 'Procura no encontrada.' };

  const estado = String(row.estado ?? '').toLowerCase();
  if (estado !== 'solicitada') {
    return {
      ok: false,
      error:
        estado === 'pendiente_pm'
          ? 'La procura ya fue enviada al Project Manager.'
          : 'La procura ya fue resuelta.',
    };
  }

  if (!transicionEstadoProcuraValida('solicitada', 'pendiente_pm')) {
    return { ok: false, error: 'Transición de estado no permitida.' };
  }

  const ahora = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('ci_procuras')
    .update({
      estado: 'pendiente_pm',
      viabilidad_presupuestaria: params.viabilidad,
      viabilidad_informada_por: params.adminNombre.slice(0, 150),
      viabilidad_informada_telegram_id: params.adminTelegramId ?? null,
      viabilidad_informada_at: ahora,
      updated_at: ahora,
    } as never)
    .eq('id', procuraId)
    .eq('estado', 'solicitada');

  if (updErr) return { ok: false, error: updErr.message };

  const alerta = await enviarAlertaPmTrasViabilidadAdmin(supabase, procuraId);

  return {
    ok: true,
    ticket: String(row.ticket ?? ''),
    pmsNotificados: alerta.enviados,
  };
}
