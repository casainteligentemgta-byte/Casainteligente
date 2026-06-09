import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import {
  getTelegramEstado,
  setTelegramContexto,
  type TelegramEstado,
} from '@/lib/telegram/estados';
import {
  listarCapitulosMaestro,
  obtenerCapituloMaestroPorId,
  tecladoCapitulosMaestro,
} from '@/lib/compras/capitulosMaestro';
import { registrarProcuraDepartamento } from '@/lib/compras/registrarProcuraDepartamento';
import {
  exigirUsuarioSistemaTelegram,
  usuarioPuedeSolicitarProcura,
} from '@/lib/compras/usuariosSistemaTelegram';
import {
  parsePrioridadProcura,
  type PrioridadProcura,
} from '@/lib/compras/viaRapidaProcura';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import { normalizarUnidadProcura, parseCantidadUnidadProcura } from '@/lib/procuras/unidadesProcura';

const PREFIX = 'cmp:';
const CB_CAP = `${PREFIX}cap:`;
const CB_PRI = `${PREFIX}pri:`;
const CB_CONS = `${PREFIX}cons:`;
const CB_OK = `${PREFIX}ok`;
const CB_NO = `${PREFIX}no`;
const CB_MONTO_SKIP = `${PREFIX}monto:skip`;

export type PasoProcuraDepartamento =
  | 'capitulo'
  | 'material'
  | 'cantidad'
  | 'prioridad'
  | 'consumible'
  | 'monto'
  | 'confirm';

export type MetadataProcuraDepartamento = {
  paso?: PasoProcuraDepartamento;
  usuario_id?: string;
  usuario_nombre?: string;
  capitulo_id?: string;
  capitulo_codigo?: string;
  capitulo_nombre?: string;
  material_txt?: string;
  cantidad?: number;
  unidad?: string;
  prioridad?: PrioridadProcura;
  es_consumible?: boolean;
  monto_estimado_usd?: number | null;
  observaciones?: string;
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function meta(estado: TelegramEstado): MetadataProcuraDepartamento {
  return (estado.metadata ?? {}) as MetadataProcuraDepartamento;
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: MetadataProcuraDepartamento,
): Promise<TelegramEstado> {
  return setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

/** True si migración 230 aplicada y hay capítulos maestro. */
export async function departamentoComprasTelegramActivo(
  supabase: SupabaseClient,
): Promise<boolean> {
  const caps = await listarCapitulosMaestro(supabase, 1);
  return caps.length > 0;
}

export function esFlujoProcuraDepartamentoTelegram(estado: TelegramEstado): boolean {
  return estado.contexto === 'procura_departamento';
}

export function esCallbackProcuraDepartamentoTelegram(data: string): boolean {
  return data.startsWith(PREFIX);
}

export async function manejarComandoProcuraDepartamentoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  telegramUserId: string | number,
): Promise<boolean> {
  const activo = await departamentoComprasTelegramActivo(supabase);
  if (!activo) return false;

  const auth = await exigirUsuarioSistemaTelegram(supabase, telegramUserId, {
    permitirRoles: ['Solicitante', 'Aprobador', 'Comprador', 'Administrador'],
  });
  if (!auth.ok) {
    await sendTelegramMessage(chatId, auth.error, { parse_mode: 'HTML' });
    return true;
  }
  if (!usuarioPuedeSolicitarProcura(auth.usuario)) {
    await sendTelegramMessage(chatId, '⛔ No tienes permiso para solicitar procuras.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  const capitulos = await listarCapitulosMaestro(supabase);
  if (!capitulos.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay capítulos configurados. Ejecute migración 230 en Supabase.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  await setTelegramContexto(supabase, chatId, {
    contexto: 'procura_departamento',
    proyecto_id: auth.usuario.proyecto_id,
    reemplazarMetadata: true,
    metadata: {
      paso: 'capitulo',
      usuario_id: auth.usuario.id,
      usuario_nombre: auth.usuario.nombre,
    },
  });

  await sendTelegramMessage(
    chatId,
    `📦 <b>Nueva procura</b>\n\nHola <b>${escHtml(auth.usuario.nombre)}</b>.\n\n` +
      `1️⃣ Elige el <b>capítulo</b> de obra:`,
    {
      parse_mode: 'HTML',
      reply_markup: tecladoCapitulosMaestro(capitulos, CB_CAP),
    },
  );
  return true;
}

async function pedirMaterial(chatId: string, cap: { codigo: string; nombre: string }): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `📂 Capítulo: <b>${escHtml(cap.codigo)}</b> — ${escHtml(cap.nombre)}\n\n` +
      `2️⃣ Describe el <b>material</b> solicitado:`,
    { parse_mode: 'HTML' },
  );
}

async function pedirPrioridad(chatId: string): Promise<void> {
  await sendTelegramMessage(chatId, '4️⃣ Elige la <b>prioridad</b>:', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 Baja', callback_data: `${CB_PRI}Baja` },
          { text: '🟡 Media', callback_data: `${CB_PRI}Media` },
          { text: '🔴 Alta', callback_data: `${CB_PRI}Alta` },
        ],
      ],
    },
  });
}

async function pedirConsumible(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '5️⃣ ¿Es <b>consumible</b>? (vía rápida si aplica)',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Sí, consumible', callback_data: `${CB_CONS}si` },
            { text: '❌ No', callback_data: `${CB_CONS}no` },
          ],
        ],
      },
    },
  );
}

async function pedirMonto(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '6️⃣ <b>Monto estimado en USD</b> (opcional, para vía rápida &lt; $50).\n' +
      'Escribe un número (ej. <code>35</code>) o pulsa Omitir.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⏭ Omitir monto', callback_data: CB_MONTO_SKIP }]],
      },
    },
  );
}

async function enviarConfirmacion(
  chatId: string,
  m: MetadataProcuraDepartamento,
): Promise<void> {
  const viaHint =
    m.es_consumible || (m.monto_estimado_usd != null && m.monto_estimado_usd < 50)
      ? '<i>Puede calificar vía rápida (Aprobada directa)</i>'
      : '<i>Vía larga — pendiente de Aprobador</i>';

  await sendTelegramMessage(
    chatId,
    `📋 <b>Confirma la procura</b>\n\n` +
      `👤 ${escHtml(m.usuario_nombre ?? '—')}\n` +
      `📂 ${escHtml(m.capitulo_codigo ?? '')} — ${escHtml(m.capitulo_nombre ?? '')}\n` +
      `📦 ${escHtml(m.material_txt ?? '')}\n` +
      `🔢 ${m.cantidad ?? '—'} ${escHtml(m.unidad ?? 'UND')}\n` +
      `⚡ Prioridad: <b>${escHtml(m.prioridad ?? 'Media')}</b>\n` +
      (m.es_consumible ? '🧴 Consumible: sí\n' : '') +
      (m.monto_estimado_usd != null ? `💵 USD ~${m.monto_estimado_usd}\n` : '') +
      `\n${viaHint}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirmar', callback_data: CB_OK },
            { text: '❌ Cancelar', callback_data: CB_NO },
          ],
        ],
      },
    },
  );
}

export async function manejarTextoProcuraDepartamentoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  telegramUserId: string | number,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoProcuraDepartamentoTelegram(estado)) return false;

  const auth = await exigirUsuarioSistemaTelegram(supabase, telegramUserId);
  if (!auth.ok) {
    await sendTelegramMessage(chatId, auth.error, { parse_mode: 'HTML' });
    return true;
  }

  const t = texto.trim();
  if (!t) {
    await sendTelegramMessage(chatId, '⚠️ Escribe un texto válido.', { parse_mode: 'HTML' });
    return true;
  }

  const m = meta(estado);
  const paso = m.paso ?? 'capitulo';

  if (paso === 'material') {
    await patchMeta(supabase, chatId, estado, {
      paso: 'cantidad',
      material_txt: t.slice(0, 500),
    });
    await sendTelegramMessage(
      chatId,
      `3️⃣ Indica <b>cantidad</b> y unidad (ej. <code>50 SAC</code>, <code>2.5 M3</code>):`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'cantidad') {
    const parsed = parseCantidadUnidadProcura(t);
    if (!parsed) {
      await sendTelegramMessage(chatId, '⚠️ Cantidad inválida. Ej: <code>10 UND</code>', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const cantidad = parsed.cantidad;
    const unidad =
      parsed.kind === 'completo'
        ? parsed.unidad
        : normalizarUnidadProcura(m.unidad ?? 'UND');
    await patchMeta(supabase, chatId, estado, {
      paso: 'prioridad',
      cantidad,
      unidad,
    });
    await pedirPrioridad(chatId);
    return true;
  }

  if (paso === 'monto') {
    const n = Number(t.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      await sendTelegramMessage(chatId, '⚠️ Monto inválido. Use un número o pulse Omitir.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const next = await patchMeta(supabase, chatId, estado, {
      paso: 'confirm',
      monto_estimado_usd: n,
    });
    await enviarConfirmacion(chatId, meta(next));
    return true;
  }

  return false;
}

export async function manejarCallbackProcuraDepartamentoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; userId: string },
): Promise<boolean> {
  if (!esCallbackProcuraDepartamentoTelegram(params.data)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoProcuraDepartamentoTelegram(estado)) {
    await answerCallbackQuery(params.callbackId, 'Sesión expirada', true);
    return true;
  }

  const auth = await exigirUsuarioSistemaTelegram(supabase, params.userId);
  if (!auth.ok) {
    await answerCallbackQuery(params.callbackId, 'No registrado', true);
    return true;
  }

  if (params.data === CB_NO || params.data === `${CB_CAP}cancel`) {
    await answerCallbackQuery(params.callbackId, 'Cancelado');
    await setTelegramContexto(supabase, params.chatId, { contexto: 'menu', metadata: {} });
    await sendTelegramMessage(params.chatId, '↩️ Procura cancelada.', { parse_mode: 'HTML' });
    return true;
  }

  if (params.data.startsWith(CB_CAP)) {
    const capId = params.data.slice(CB_CAP.length);
    const cap = await obtenerCapituloMaestroPorId(supabase, capId);
    if (!cap) {
      await answerCallbackQuery(params.callbackId, 'Capítulo no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, cap.codigo);
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'material',
      capitulo_id: cap.id,
      capitulo_codigo: cap.codigo,
      capitulo_nombre: cap.nombre,
    });
    await pedirMaterial(params.chatId, cap);
    return true;
  }

  if (params.data.startsWith(CB_PRI)) {
    const pri = parsePrioridadProcura(params.data.slice(CB_PRI.length));
    if (!pri) {
      await answerCallbackQuery(params.callbackId, 'Prioridad inválida', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, pri);
    await patchMeta(supabase, params.chatId, estado, { paso: 'consumible', prioridad: pri });
    await pedirConsumible(params.chatId);
    return true;
  }

  if (params.data.startsWith(CB_CONS)) {
    const si = params.data.endsWith('si');
    await answerCallbackQuery(params.callbackId, si ? 'Consumible' : 'No consumible');
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'monto',
      es_consumible: si,
    });
    await pedirMonto(params.chatId);
    return true;
  }

  if (params.data === CB_MONTO_SKIP) {
    await answerCallbackQuery(params.callbackId, 'Sin monto');
    const next = await patchMeta(supabase, params.chatId, estado, {
      paso: 'confirm',
      monto_estimado_usd: null,
    });
    await enviarConfirmacion(params.chatId, meta(next));
    return true;
  }

  if (params.data === CB_OK) {
    await answerCallbackQuery(params.callbackId, 'Registrando…');
    const fresh = await getTelegramEstado(supabase, params.chatId);
    const m = meta(fresh);

    if (!m.capitulo_id || !m.material_txt || !m.cantidad || !m.prioridad) {
      await sendTelegramMessage(params.chatId, '❌ Datos incompletos. Use /procura de nuevo.', {
        parse_mode: 'HTML',
      });
      return true;
    }

    const { data, error } = await registrarProcuraDepartamento(supabase, {
      usuario: auth.usuario,
      capituloMaestroId: m.capitulo_id,
      descripcionMaterial: m.material_txt,
      cantidad: m.cantidad,
      unidad: m.unidad ?? 'UND',
      prioridad: m.prioridad,
      montoEstimadoUsd: m.monto_estimado_usd ?? null,
      esConsumible: m.es_consumible ?? false,
    });

    await setTelegramContexto(supabase, params.chatId, { contexto: 'menu', metadata: {} });

    if (error || !data) {
      await sendTelegramMessage(
        params.chatId,
        `❌ ${escHtml(error?.message ?? 'Error al registrar')}`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const msgVia = data.viaRapida
      ? `⚡ <b>Vía rápida</b> — ${escHtml(etiquetaEstadoProcura('aprobada_directa'))}\n${escHtml(data.motivoVia)}`
      : `⏳ <b>Vía larga</b> — pendiente de aprobación en oficina / canal admin.`;

    await sendTelegramMessage(
      params.chatId,
      `✅ <b>Procura registrada</b>\n\n` +
        `🎫 ${escHtml(data.ticket)}\n` +
        `📂 ${escHtml(m.capitulo_codigo ?? '')}\n` +
        `📦 ${escHtml(m.material_txt)}\n\n` +
        msgVia,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}
