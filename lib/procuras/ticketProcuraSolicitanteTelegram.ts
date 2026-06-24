import type { SupabaseClient } from '@supabase/supabase-js';
import { nombreMaterialProcuraVisible } from '@/lib/compras/procuraMaterialTexto';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import {
  editTelegramMessage,
  sendTelegramMessageWithId,
} from '@/lib/telegram/botApi';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type HistorialTicketSolicitante = {
  estado_anterior: string;
  estado_nuevo: string;
  motivo?: string | null;
  usuario?: string | null;
};

export type FilaTicketProcuraSolicitante = {
  id: string;
  ticket: string;
  material_txt: string;
  cantidad: number;
  unidad: string;
  estado: string;
  via_rapida?: boolean | null;
  viabilidad_presupuestaria?: string | null;
  viabilidad_informada_por?: string | null;
  motivo_rechazo?: string | null;
  solicitante_nombre?: string | null;
  solicitante_telegram_chat_id?: number | string | null;
  solicitante_telegram_message_id?: number | null;
  stock_almacen_detectado?: number | null;
  cantidad_compra?: number | null;
};

export type OpcionesMensajeTicketSolicitante = {
  ordenCompraEmitida?: boolean;
  despachoCodigo?: string | null;
  pmAprobadorNombre?: string | null;
};

const SELECT_TICKET_SOLICITANTE = `
  id,ticket,material_txt,cantidad,unidad,estado,via_rapida,
  viabilidad_presupuestaria,viabilidad_informada_por,motivo_rechazo,
  solicitante_nombre,solicitante_telegram_chat_id,solicitante_telegram_message_id,
  stock_almacen_detectado,cantidad_compra
`;

function lineasFirmasAprobacion(
  row: FilaTicketProcuraSolicitante,
  historial: HistorialTicketSolicitante[],
  opts?: OpcionesMensajeTicketSolicitante,
): string[] {
  const lineas: string[] = ['📝 Procura registrada'];

  const via = row.viabilidad_presupuestaria?.trim().toLowerCase();
  const informante = row.viabilidad_informada_por?.trim();
  if (via === 'si' && informante) {
    lineas.push(`✅ Contador: disponibilidad confirmada (${escHtml(informante)})`);
  } else if (via === 'no' && informante) {
    lineas.push(`⚠️ Contador: sin disponibilidad (${escHtml(informante)})`);
  }

  if (row.via_rapida) {
    lineas.push('⚡ Vía rápida — aprobación automática');
  }

  const transPm = historial.find(
    (h) =>
      String(h.estado_anterior).toLowerCase() === 'pendiente_pm' &&
      String(h.estado_nuevo).toLowerCase() === 'aprobada',
  );
  if (transPm) {
    const quien =
      opts?.pmAprobadorNombre?.trim() ||
      transPm.usuario?.trim() ||
      'Project Manager';
    lineas.push(`✅ PM: aprobada (${escHtml(quien)})`);
  } else if (opts?.pmAprobadorNombre?.trim()) {
    lineas.push(`✅ PM: aprobada (${escHtml(opts.pmAprobadorNombre.trim())})`);
  }

  const transRech = historial.find((h) => String(h.estado_nuevo).toLowerCase() === 'rechazada');
  if (transRech || row.motivo_rechazo?.trim()) {
    const motivo = row.motivo_rechazo?.trim() || transRech?.motivo?.trim() || '—';
    lineas.push(`❌ Rechazada: ${escHtml(motivo)}`);
  }

  if (opts?.despachoCodigo?.trim()) {
    lineas.push(`📦 Despacho almacén: ${escHtml(opts.despachoCodigo.trim())}`);
  } else if (
    Number(row.stock_almacen_detectado ?? 0) > 0 &&
    Number(row.cantidad_compra ?? 0) <= 0 &&
    String(row.estado).toLowerCase() === 'aprobada'
  ) {
    lineas.push('📦 Despacho desde almacén en curso');
  }

  if (opts?.ordenCompraEmitida) {
    lineas.push('🛒 Orden enviada al comprador');
  }

  return lineas;
}

function tituloEstadoTicket(row: FilaTicketProcuraSolicitante): string {
  const est = String(row.estado ?? '').toLowerCase();
  if (est === 'rechazada' || est === 'cancelada') {
    return '❌ <b>NO APROBADO</b>';
  }
  if (
    est === 'aprobada' ||
    est === 'aprobada_directa' ||
    est === 'en_compra' ||
    est === 'recibida' ||
    est === 'recibida_parcial'
  ) {
    return '✅ <b>APROBADO</b>';
  }
  if (est === 'pendiente_pm') {
    return '⏳ <b>EN TRÁMITE</b> — pendiente del PM';
  }
  if (est === 'solicitada') {
    return '⏳ <b>EN TRÁMITE</b> — pendiente del Contador';
  }
  return `🔄 <b>${escHtml(etiquetaEstadoProcura(est))}</b>`;
}

/** Texto del ticket único para el solicitante (se edita en cada paso). */
export function construirMensajeTicketProcuraSolicitante(
  row: FilaTicketProcuraSolicitante,
  historial: HistorialTicketSolicitante[] = [],
  opts?: OpcionesMensajeTicketSolicitante,
): string {
  const material = nombreMaterialProcuraVisible(row.material_txt);
  const qty = Number(row.cantidad).toLocaleString('es-VE');
  const unidad = escHtml(row.unidad?.trim() || 'UND');
  const firmas = lineasFirmasAprobacion(row, historial, opts);

  return (
    `${tituloEstadoTicket(row)}\n\n` +
    `🎫 <b>Ticket:</b> ${escHtml(String(row.ticket))}\n` +
    `📦 ${escHtml(material)} — <b>${qty}</b> ${unidad}\n\n` +
    `<b>Seguimiento:</b>\n` +
    firmas.map((l) => `• ${l}`).join('\n')
  );
}

export async function cargarProcuraTicketSolicitante(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<FilaTicketProcuraSolicitante | null> {
  const { data, error } = await supabase
    .from('ci_procuras')
    .select(SELECT_TICKET_SOLICITANTE)
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error) {
    if (/solicitante_telegram_message_id|schema cache/i.test(error.message)) {
      const { data: fallback } = await supabase
        .from('ci_procuras')
        .select(
          'id,ticket,material_txt,cantidad,unidad,estado,via_rapida,viabilidad_presupuestaria,viabilidad_informada_por,motivo_rechazo,solicitante_nombre,solicitante_telegram_chat_id,stock_almacen_detectado,cantidad_compra',
        )
        .eq('id', procuraId.trim())
        .maybeSingle();
      return fallback as FilaTicketProcuraSolicitante | null;
    }
    throw new Error(error.message);
  }
  return data as FilaTicketProcuraSolicitante | null;
}

async function cargarHistorialTicket(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<HistorialTicketSolicitante[]> {
  const { data, error } = await supabase
    .from('ci_procura_estados_historial')
    .select('estado_anterior,estado_nuevo,motivo,usuario')
    .eq('procura_id', procuraId.trim())
    .order('created_at', { ascending: true });

  if (error) {
    if (/42P01|schema cache/i.test(error.message)) return [];
    console.warn('[ticketProcuraSolicitante] historial', error.message);
    return [];
  }
  return (data ?? []) as HistorialTicketSolicitante[];
}

export async function persistirMessageIdTicketProcura(
  supabase: SupabaseClient,
  procuraId: string,
  messageId: number,
): Promise<void> {
  const { error } = await supabase
    .from('ci_procuras')
    .update({
      solicitante_telegram_message_id: messageId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', procuraId.trim());

  if (error && !/solicitante_telegram_message_id|schema cache/i.test(error.message)) {
    console.warn('[ticketProcuraSolicitante] persist message_id', error.message);
  }
}

/** Primer envío del ticket al registrar la procura. */
export async function publicarTicketProcuraSolicitante(
  supabase: SupabaseClient,
  procuraId: string,
  opts?: OpcionesMensajeTicketSolicitante,
): Promise<{ enviado: boolean; messageId?: number }> {
  const row = await cargarProcuraTicketSolicitante(supabase, procuraId);
  if (!row) return { enviado: false };

  const chat = row.solicitante_telegram_chat_id;
  if (chat == null || String(chat).trim() === '') return { enviado: false };

  const historial = await cargarHistorialTicket(supabase, procuraId);
  const texto = construirMensajeTicketProcuraSolicitante(row, historial, opts);

  try {
    const messageId = await sendTelegramMessageWithId(String(chat), texto, {
      parse_mode: 'HTML',
      rolDestinatario: 'Solicitante',
      nombreDestinatario: row.solicitante_nombre,
      accionLogDestinatario: 'solo_notificacion',
      contextoLogEspejo: '[Procura · ticket solicitante]',
    });
    await persistirMessageIdTicketProcura(supabase, procuraId, messageId);
    return { enviado: true, messageId };
  } catch (e) {
    console.warn('[ticketProcuraSolicitante] publicar', row.ticket, e);
    return { enviado: false };
  }
}

/** Edita el ticket existente o publica uno nuevo si no hay message_id. */
export async function actualizarTicketProcuraSolicitante(
  supabase: SupabaseClient,
  procuraId: string,
  opts?: OpcionesMensajeTicketSolicitante,
): Promise<boolean> {
  const row = await cargarProcuraTicketSolicitante(supabase, procuraId);
  if (!row) return false;

  const chat = row.solicitante_telegram_chat_id;
  if (chat == null || String(chat).trim() === '') return false;

  const historial = await cargarHistorialTicket(supabase, procuraId);
  const texto = construirMensajeTicketProcuraSolicitante(row, historial, opts);
  const messageId = row.solicitante_telegram_message_id;

  if (messageId == null || !Number.isFinite(Number(messageId))) {
    const pub = await publicarTicketProcuraSolicitante(supabase, procuraId, opts);
    return pub.enviado;
  }

  try {
    await editTelegramMessage(String(chat), Number(messageId), texto, { parse_mode: 'HTML' });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/message to edit not found|message can't be edited|chat not found/i.test(msg)) {
      const pub = await publicarTicketProcuraSolicitante(supabase, procuraId, opts);
      return pub.enviado;
    }
    console.warn('[ticketProcuraSolicitante] actualizar', row.ticket, e);
    return false;
  }
}
