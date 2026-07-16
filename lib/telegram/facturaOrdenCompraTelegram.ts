import type { SupabaseClient } from '@supabase/supabase-js';
import { esUuidProcura } from '@/lib/compras/telegramMetadata';
import { cargarProcuraOrdenCompra } from '@/lib/procuras/emitirOrdenCompraProcura';
import { answerCallbackQuery } from '@/lib/telegram/botApi';
import { iniciarModoCargaFacturasTelegram } from '@/lib/telegram/mensajesFactura';
import {
  iniciarFacturaCompradorManualTelegram,
  type ContextoFacturaProcura,
} from '@/lib/telegram/facturaCompradorManualTelegram';
import { setTelegramContexto } from '@/lib/telegram/estados';

export const CB_CMP_FAC_FOTO = 'cmp:fc:fo:';
export const CB_CMP_FAC_MANUAL = 'cmp:fc:mn:';

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
    ],
  };
}

export function esCallbackFacturaOrdenCompraProcura(data: string): boolean {
  return data.startsWith(CB_CMP_FAC_FOTO) || data.startsWith(CB_CMP_FAC_MANUAL);
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
