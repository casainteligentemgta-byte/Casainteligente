import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import {
  getTelegramEstado,
  setTelegramContexto,
  type TelegramEstado,
} from '@/lib/telegram/estados';
import { enviarPickerProyectosTelegram, nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';

const PREFIX = 'prc:';
const CB_CONFIRM = `${PREFIX}ok`;
const CB_CANCEL = `${PREFIX}no`;

export type PasoProcuraTelegram = 'material' | 'cantidad' | 'observaciones';

export type MetadataProcuraTelegram = {
  paso?: PasoProcuraTelegram;
  material_txt?: string;
  cantidad?: number;
  unidad?: string;
  observaciones?: string;
  nombre_obra?: string;
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function metaProcura(estado: TelegramEstado): MetadataProcuraTelegram {
  return (estado.metadata ?? {}) as MetadataProcuraTelegram;
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: MetadataProcuraTelegram,
): Promise<TelegramEstado> {
  return setTelegramContexto(supabase, chatId, {
    metadata: { ...metaProcura(estado), ...patch },
  });
}

function parseCantidadUnidad(texto: string): { cantidad: number; unidad: string } | null {
  const t = texto.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  const cantidad = Number(parts[0]?.replace(',', '.'));
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
  const unidad = parts.slice(1).join(' ').trim().toUpperCase() || 'UND';
  return { cantidad, unidad: unidad.slice(0, 16) || 'UND' };
}

export function esFlujoProcuraTelegram(estado: TelegramEstado): boolean {
  return estado.contexto === 'procura_solicitud';
}

export function esCallbackProcuraTelegram(data: string): boolean {
  return data.startsWith(PREFIX);
}

export async function manejarComandoProcuraTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    metadata: {},
  });
  await enviarPickerProyectosTelegram(supabase, chatId, 'procura');
}

export async function prepararProcuraTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await setTelegramContexto(supabase, chatId, {
    contexto: 'procura_solicitud',
    proyecto_id: proyectoId,
    metadata: {
      paso: 'material',
      nombre_obra: nombre,
    },
  });
  await sendTelegramMessage(
    chatId,
    `📦 <b>Solicitud de procura</b>\n\n` +
      `Obra: <b>${escHtml(nombre)}</b>\n\n` +
      `1️⃣ Escribe la <b>descripción del material</b> que necesitas.\n` +
      `<i>Ej.: Cemento gris 42.5 kg, 50 sacos</i>`,
    { parse_mode: 'HTML' },
  );
}

async function enviarResumenConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = metaProcura(estado);
  const nombreObra = m.nombre_obra ?? (await nombreProyectoTelegram(supabase, estado.proyecto_id)) ?? '—';
  await sendTelegramMessage(
    chatId,
    `📋 <b>Confirma la procura</b>\n\n` +
      `🏗 Obra: <b>${escHtml(nombreObra)}</b>\n` +
      `📦 Material: <b>${escHtml(m.material_txt ?? '—')}</b>\n` +
      `🔢 Cantidad: <b>${m.cantidad ?? '—'} ${escHtml(m.unidad ?? 'UND')}</b>\n` +
      (m.observaciones ? `📝 Nota: ${escHtml(m.observaciones)}\n` : '') +
      `\nEstado inicial: <b>${escHtml(etiquetaEstadoProcura('solicitada'))}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirmar', callback_data: CB_CONFIRM },
            { text: '❌ Cancelar', callback_data: CB_CANCEL },
          ],
        ],
      },
    },
  );
}

async function registrarProcuraTelegram(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = metaProcura(estado);
  const proyectoId = estado.proyecto_id?.trim();
  const materialTxt = m.material_txt?.trim();
  const cantidad = m.cantidad;
  const unidad = m.unidad?.trim() || 'UND';

  if (!proyectoId || !materialTxt || !cantidad || cantidad <= 0) {
    await sendTelegramMessage(chatId, '❌ Datos incompletos. Usa <code>/procura</code> de nuevo.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const entidadId = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);
  const chatNum = Number(chatId);

  const row: Record<string, unknown> = {
    material_txt: materialTxt.slice(0, 500),
    cantidad,
    unidad,
    proyecto_id: proyectoId,
    estado: 'solicitada',
    observaciones: m.observaciones?.trim()?.slice(0, 2000) || null,
  };
  if (entidadId) row.entidad_id = entidadId;
  if (Number.isFinite(chatNum) && chatNum > 0) {
    row.solicitante_telegram_chat_id = Math.trunc(chatNum);
  }

  const { data, error } = await supabase
    .from('ci_procuras')
    .insert(row as never)
    .select('ticket, material_txt, cantidad, unidad')
    .single();

  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    metadata: {},
  });

  if (error) {
    const hint = /ci_procuras/i.test(error.message)
      ? '\n\n<i>Aplique la migración 224 en Supabase.</i>'
      : '';
    await sendTelegramMessage(chatId, `❌ No se pudo registrar: ${escHtml(error.message)}${hint}`, {
      parse_mode: 'HTML',
    });
    return;
  }

  await sendTelegramMessage(
    chatId,
    `✅ <b>Procura registrada</b>\n\n` +
      `🎫 Ticket: <b>${escHtml(data.ticket)}</b>\n` +
      `📦 ${escHtml(data.material_txt)}\n` +
      `🔢 ${Number(data.cantidad).toLocaleString('es-VE')} ${escHtml(data.unidad)}\n\n` +
      `El equipo de abastecimiento la verá en Contabilidad → Procuras.`,
    { parse_mode: 'HTML' },
  );
}

export async function manejarTextoProcuraTelegram(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoProcuraTelegram(estado)) return false;

  const t = texto.trim();
  if (!t) {
    await sendTelegramMessage(chatId, '⚠️ Escribe un texto válido o usa /cancelar.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  const m = metaProcura(estado);
  const paso = m.paso ?? 'material';

  if (paso === 'material') {
    if (t.length < 2) {
      await sendTelegramMessage(chatId, '⚠️ Describe el material con al menos 2 caracteres.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    await patchMeta(supabase, chatId, estado, {
      paso: 'cantidad',
      material_txt: t.slice(0, 500),
    });
    await sendTelegramMessage(
      chatId,
      `2️⃣ Indica la <b>cantidad</b> (y unidad opcional).\n` +
        `<i>Ej.: 50 UND · 10 · 2.5 M3</i>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'cantidad') {
    const parsed = parseCantidadUnidad(t);
    if (!parsed) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Cantidad inválida. Ejemplo: <code>50 UND</code> o <code>10</code>',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    const next = await patchMeta(supabase, chatId, estado, {
      paso: 'observaciones',
      cantidad: parsed.cantidad,
      unidad: parsed.unidad,
    });
    await sendTelegramMessage(
      chatId,
      `3️⃣ <b>Observaciones</b> (opcional).\n` +
        `Escribe una nota o envía <code>-</code> para omitir.`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'observaciones') {
    const obs = t === '-' || t.toLowerCase() === 'omitir' ? undefined : t.slice(0, 2000);
    const next = await patchMeta(supabase, chatId, estado, {
      observaciones: obs,
      paso: 'observaciones',
    });
    await enviarResumenConfirmacion(supabase, chatId, next);
    return true;
  }

  return false;
}

export async function manejarCallbackProcuraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackProcuraTelegram(params.data)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoProcuraTelegram(estado)) {
    await answerCallbackQuery(params.callbackId, 'Sesión expirada', true);
    return true;
  }

  if (params.data === CB_CANCEL) {
    await answerCallbackQuery(params.callbackId, 'Cancelado');
    await setTelegramContexto(supabase, params.chatId, {
      contexto: 'menu',
      metadata: {},
    });
    await sendTelegramMessage(params.chatId, '↩️ Procura cancelada. Usa /procura para otra solicitud.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (params.data === CB_CONFIRM) {
    await answerCallbackQuery(params.callbackId, 'Registrando…');
    await registrarProcuraTelegram(supabase, params.chatId, estado);
    return true;
  }

  return false;
}
