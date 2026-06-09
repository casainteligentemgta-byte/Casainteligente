import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { insertarProcura } from '@/lib/procuras/registrarProcura';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import { resolverSolicitanteDesdeTelegram } from '@/lib/procuras/solicitanteProcura';
import {
  normalizarUnidadProcura,
  parseCantidadUnidadProcura,
  tecladoUnidadesProcuraPagina,
} from '@/lib/procuras/unidadesProcura';
import {
  getTelegramEstado,
  setTelegramContexto,
  type TelegramEstado,
} from '@/lib/telegram/estados';
import { enviarPickerProyectosTelegram, nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';

const PREFIX = 'prc:';
const CB_CONFIRM = `${PREFIX}ok`;
const CB_CANCEL = `${PREFIX}no`;
const CB_UNIDAD = `${PREFIX}u:`;
const CB_UNIDAD_PAGE = `${PREFIX}pg:`;

export type PasoProcuraTelegram = 'material' | 'cantidad' | 'unidad' | 'observaciones';

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

async function pedirObservacionesProcura(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `3️⃣ <b>Observaciones</b> (opcional).\n` +
      `Escribe una nota o envía <code>-</code> para omitir.`,
    { parse_mode: 'HTML' },
  );
}

async function enviarPickerUnidadProcura(chatId: string, cantidad: number, page = 0): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `2️⃣ Cantidad: <b>${cantidad.toLocaleString('es-VE')}</b>\n\n` +
      `Elige la <b>unidad de medida</b>:\n` +
      `<i>También puedes escribir, ej. M3, Litros, Pulgadas</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: tecladoUnidadesProcuraPagina(CB_UNIDAD, page),
    },
  );
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
  const solicitante = await resolverSolicitanteDesdeTelegram(supabase, chatId);
  await sendTelegramMessage(
    chatId,
    `📋 <b>Confirma la procura</b>\n\n` +
      `👤 Solicita: <b>${escHtml(solicitante.nombre)}</b>\n` +
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
  const unidad = normalizarUnidadProcura(m.unidad);

  if (!proyectoId || !materialTxt || !cantidad || cantidad <= 0) {
    await sendTelegramMessage(chatId, '❌ Datos incompletos. Usa <code>/procura</code> de nuevo.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const entidadId = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);

  const { data, error } = await insertarProcura(
    supabase,
    {
      material_txt: materialTxt,
      cantidad,
      unidad,
      proyecto_id: proyectoId,
      entidad_id: entidadId,
      estado: 'solicitada',
      observaciones: m.observaciones?.trim()?.slice(0, 2000) || null,
    },
    { origen: 'telegram', telegram_chat_id: chatId },
  );

  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    metadata: {},
  });

  if (error) {
    const hint = /ci_procuras|solicitante_nombre/i.test(error.message)
      ? '\n\n<i>Aplique las migraciones 224 y 225 en Supabase.</i>'
      : '';
    await sendTelegramMessage(chatId, `❌ No se pudo registrar: ${escHtml(error.message)}${hint}`, {
      parse_mode: 'HTML',
    });
    return;
  }

  const ticket = String(data.ticket ?? '');
  const solicitanteNombre = String(data.solicitante_nombre ?? '');

  await sendTelegramMessage(
    chatId,
    `✅ <b>Procura registrada</b>\n\n` +
      `🎫 Ticket: <b>${escHtml(ticket)}</b>\n` +
      (solicitanteNombre ? `👤 Solicitante: <b>${escHtml(solicitanteNombre)}</b>\n` : '') +
      `📦 ${escHtml(String(data.material_txt ?? materialTxt))}\n` +
      `🔢 ${Number(data.cantidad).toLocaleString('es-VE')} ${escHtml(String(data.unidad ?? unidad))}\n\n` +
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
        `<i>Ej.: 50 SAC · 2.5 M3 · 100 Mts · 20 Litros · 4 Pulgadas · 10</i>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'cantidad') {
    const parsed = parseCantidadUnidadProcura(t);
    if (!parsed) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Cantidad inválida. Ejemplo: <code>50 M3</code>, <code>20 Litros</code> o <code>10</code>',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    if (parsed.kind === 'solo_cantidad') {
      await patchMeta(supabase, chatId, estado, {
        paso: 'unidad',
        cantidad: parsed.cantidad,
      });
      await enviarPickerUnidadProcura(chatId, parsed.cantidad);
      return true;
    }

    await patchMeta(supabase, chatId, estado, {
      paso: 'observaciones',
      cantidad: parsed.cantidad,
      unidad: parsed.unidad,
    });
    await pedirObservacionesProcura(chatId);
    return true;
  }

  if (paso === 'unidad') {
    if (!Number.isFinite(m.cantidad) || (m.cantidad ?? 0) <= 0) {
      await sendTelegramMessage(chatId, '⚠️ Falta la cantidad. Usa /procura de nuevo.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const unidad = normalizarUnidadProcura(t);
    await patchMeta(supabase, chatId, estado, {
      paso: 'observaciones',
      unidad,
    });
    await pedirObservacionesProcura(chatId);
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

  if (params.data.startsWith(CB_UNIDAD_PAGE)) {
    const page = Number(params.data.slice(CB_UNIDAD_PAGE.length));
    const m = metaProcura(estado);
    if (!Number.isFinite(m.cantidad) || (m.cantidad ?? 0) <= 0) {
      await answerCallbackQuery(params.callbackId, 'Cantidad pendiente', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId);
    await enviarPickerUnidadProcura(params.chatId, m.cantidad!, page);
    return true;
  }

  if (params.data.startsWith(CB_UNIDAD)) {
    const code = params.data.slice(CB_UNIDAD.length);
    const m = metaProcura(estado);
    if (!Number.isFinite(m.cantidad) || (m.cantidad ?? 0) <= 0) {
      await answerCallbackQuery(params.callbackId, 'Cantidad pendiente', true);
      return true;
    }
    const unidad = normalizarUnidadProcura(code);
    await answerCallbackQuery(params.callbackId, unidad);
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'observaciones',
      unidad,
    });
    await pedirObservacionesProcura(params.chatId);
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
