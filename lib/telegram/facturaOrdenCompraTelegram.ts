import type { SupabaseClient } from '@supabase/supabase-js';
import { esUuidProcura } from '@/lib/compras/telegramMetadata';
import { cargarProcuraOrdenCompra } from '@/lib/procuras/emitirOrdenCompraProcura';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { obtenerUsuarioSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { iniciarModoCargaFacturasTelegram } from '@/lib/telegram/mensajesFactura';
import {
  iniciarFacturaCompradorManualTelegram,
  type ContextoFacturaProcura,
} from '@/lib/telegram/facturaCompradorManualTelegram';
import { setTelegramContexto } from '@/lib/telegram/estados';

export const CB_CMP_FAC_FOTO = 'cmp:fc:fo:';
export const CB_CMP_FAC_MANUAL = 'cmp:fc:mn:';
/** El comprador avisa que está cotizando: la Torre de Control le da más plazo. */
export const CB_CMP_COTIZANDO = 'cmp:fc:cz:';

export function tecladoFacturaOrdenCompraProcura(procuraId: string): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  const id = procuraId.trim();
  return {
    inline_keyboard: [
      [
        { text: '📷 Foto de factura', callback_data: `${CB_CMP_FAC_FOTO}${id}` },
        { text: '🧾 Carga manual', callback_data: `${CB_CMP_FAC_MANUAL}${id}` },
      ],
      [{ text: '🔎 Estoy cotizando', callback_data: `${CB_CMP_COTIZANDO}${id}` }],
    ],
  };
}

export function esCallbackFacturaOrdenCompraProcura(data: string): boolean {
  return data.startsWith(CB_CMP_FAC_FOTO) || data.startsWith(CB_CMP_FAC_MANUAL) || data.startsWith(CB_CMP_COTIZANDO);
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Marca la procura «en cotización» (solo si sigue aprobada sin comprar). */
async function marcarCotizando(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; procuraId: string },
): Promise<void> {
  const usuario = await obtenerUsuarioSistemaTelegram(supabase, params.chatId).catch(() => null);
  const nombre = usuario?.nombre?.trim() || 'Comprador';
  const { data, error } = await supabase
    .from('ci_procuras')
    .update({ cotizando_at: new Date().toISOString(), cotizando_por: nombre })
    .eq('id', params.procuraId)
    .in('estado', ['aprobada', 'aprobada_directa'])
    .select('ticket');
  if (error) {
    await answerCallbackQuery(params.callbackId, 'No se pudo marcar', true);
    return;
  }
  const fila = (data ?? [])[0] as { ticket?: string | null } | undefined;
  if (!fila) {
    await answerCallbackQuery(params.callbackId, 'Esta procura ya no está pendiente de compra', true);
    return;
  }
  await answerCallbackQuery(params.callbackId, 'Anotado: en cotización');
  await sendTelegramMessage(
    params.chatId,
    `🔎 <b>${escHtml(String(fila.ticket ?? 'Procura'))}</b> en cotización por ${escHtml(nombre)}.\n` +
      'La Torre de Control le da 5 días antes de avisar. Cuando compre, registre la factura con los botones de arriba.',
    { parse_mode: 'HTML' },
  );
}

function parseCallbackFacturaOrdenCompra(data: string): {
  modo: 'foto' | 'manual';
  procuraId: string;
} | null {
  if (data.startsWith(CB_CMP_FAC_FOTO)) {
    const procuraId = data.slice(CB_CMP_FAC_FOTO.length).trim();
    return esUuidProcura(procuraId) ? { modo: 'foto', procuraId } : null;
  }
  if (data.startsWith(CB_CMP_FAC_MANUAL)) {
    const procuraId = data.slice(CB_CMP_FAC_MANUAL.length).trim();
    return esUuidProcura(procuraId) ? { modo: 'manual', procuraId } : null;
  }
  return null;
}

async function contextoDesdeProcura(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<ContextoFacturaProcura | null> {
  const procura = await cargarProcuraOrdenCompra(supabase, procuraId);
  if (!procura) return null;
  return {
    procuraId: procura.id,
    ticket: String(procura.ticket ?? ''),
    proyectoId: procura.proyecto_id?.trim() || null,
    entidadId: procura.entidad_id?.trim() || null,
    materialId: procura.material_id?.trim() || null,
    materialTxt: procura.material_txt?.trim() || null,
    cantidad: Number(procura.cantidad),
    unidad: String(procura.unidad ?? 'UND'),
  };
}

export async function manejarCallbackFacturaOrdenCompraProcura(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (params.data.startsWith(CB_CMP_COTIZANDO)) {
    const procuraId = params.data.slice(CB_CMP_COTIZANDO.length).trim();
    if (!esUuidProcura(procuraId)) return false;
    await marcarCotizando(supabase, { ...params, procuraId });
    return true;
  }

  const parsed = parseCallbackFacturaOrdenCompra(params.data);
  if (!parsed) return false;

  const ctx = await contextoDesdeProcura(supabase, parsed.procuraId);
  if (!ctx) {
    await answerCallbackQuery(params.callbackId, 'Procura no encontrada', true);
    return true;
  }

  await answerCallbackQuery(
    params.callbackId,
    parsed.modo === 'foto' ? 'Envíe la foto de la factura' : 'Carga manual',
  );

  if (parsed.modo === 'foto') {
    await setTelegramContexto(supabase, params.chatId, {
      contexto: 'factura',
      metadata: { procura_id: ctx.procuraId, procura_ticket: ctx.ticket },
      ...(ctx.proyectoId ? { proyecto_id: ctx.proyectoId } : {}),
    });
    await iniciarModoCargaFacturasTelegram(supabase, params.chatId, {
      procuraId: ctx.procuraId,
      ticket: ctx.ticket,
    });
  } else {
    await iniciarFacturaCompradorManualTelegram(supabase, params.chatId, ctx);
  }
  return true;
}
