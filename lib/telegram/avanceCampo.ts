import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { emojiEficiencia } from '@/lib/campo/calculosAvance';
import {
  listarPartidasCampoProyecto,
  registrarAvanceDiarioCampo,
  type PartidaCampoRow,
} from '@/lib/campo/avanceDiarioCampo';
import { empleadoPorTelegramChatId } from '@/lib/campo/ingenieroResidente';
import {
  getTelegramEstado,
  setTelegramContexto,
  type TelegramEstado,
} from '@/lib/telegram/estados';

const PREFIX = 'avc:';
const CB_REPORTAR = `${PREFIX}reportar`;
const CB_PARTIDA = `${PREFIX}p:`;
const CB_PROYECTO = `${PREFIX}pr:`;

export function esCallbackAvanceCampo(data: string): boolean {
  return data.startsWith(PREFIX);
}

function truncar(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function tecladoPartidas(
  partidas: PartidaCampoRow[],
  proyectoId: string,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const p of partidas.slice(0, 20)) {
    const cod = p.codigo_lulo ?? p.codigo;
    const label = truncar(`🧱 ${cod} — ${p.descripcion}`, 60);
    rows.push([
      {
        text: label,
        callback_data: `${CB_PARTIDA}${proyectoId}:${p.id}`,
      },
    ]);
  }
  return { inline_keyboard: rows };
}

export async function enviarInvitacionAvanceDiario(
  supabase: SupabaseClient,
  chatId: string | number,
  proyectoId: string,
  proyectoNombre: string,
): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `🏗️ <b>${proyectoNombre}</b>\n\nEs hora del reporte de avance de hoy. ¿Qué partida ejecutaste?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📊 Reportar Avance de Hoy',
              callback_data: `${CB_REPORTAR}:${proyectoId}`,
            },
          ],
        ],
      },
    },
  );
}

export async function manejarCallbackAvanceCampo(
  supabase: SupabaseClient,
  opts: {
    chatId: string;
    callbackId: string;
    data: string;
    telegramUserId: string;
  },
): Promise<boolean> {
  if (!esCallbackAvanceCampo(opts.data)) return false;

  if (opts.data.startsWith(CB_REPORTAR)) {
    const proyectoId = opts.data.slice(CB_REPORTAR.length + 1);
    await answerCallbackQuery(opts.callbackId, 'Cargando partidas…');
    const partidas = await listarPartidasCampoProyecto(supabase, proyectoId, 25);
    if (!partidas.length) {
      await sendTelegramMessage(
        opts.chatId,
        '⚠️ No hay partidas en presupuesto para esta obra. Importa el MDB en Control de obra.',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await setTelegramContexto(supabase, opts.chatId, {
      contexto: 'avance_campo',
      proyecto_id: proyectoId,
      metadata: { paso: 'elegir_partida' },
    });
    await sendTelegramMessage(
      opts.chatId,
      '📋 <b>Selecciona la partida</b> que reportas hoy:',
      {
        parse_mode: 'HTML',
        reply_markup: tecladoPartidas(partidas, proyectoId),
      },
    );
    return true;
  }

  if (opts.data.startsWith(CB_PARTIDA)) {
    const rest = opts.data.slice(CB_PARTIDA.length);
    const [proyectoId, partidaId] = rest.split(':');
    if (!proyectoId || !partidaId) return true;

    await answerCallbackQuery(opts.callbackId);
    const partidas = await listarPartidasCampoProyecto(supabase, proyectoId, 200);
    const partida = partidas.find((p) => p.id === partidaId);
    if (!partida) {
      await sendTelegramMessage(opts.chatId, 'Partida no encontrada.');
      return true;
    }

    await setTelegramContexto(supabase, opts.chatId, {
      contexto: 'avance_campo_cantidad',
      proyecto_id: proyectoId,
      metadata: {
        partida_id: partidaId,
        codigo: partida.codigo,
        descripcion: partida.descripcion,
        unidad: partida.unidad,
        rendimiento: partida.rendimiento,
      },
    });

    await sendTelegramMessage(
      opts.chatId,
      `✏️ <b>${partida.codigo}</b> — ${partida.descripcion}\n\n` +
        `Envía la <b>cantidad ejecutada hoy</b> (${partida.unidad}).\n` +
        `Ejemplo: <code>25</code>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarTextoAvanceCampo(
  supabase: SupabaseClient,
  chatId: string,
  text: string,
  estado: TelegramEstado,
  telegramUserId: string,
): Promise<boolean> {
  if (estado.contexto !== 'avance_campo_cantidad') return false;

  const meta = estado.metadata ?? {};
  const partidaId = String(meta.partida_id ?? '');
  const proyectoId = estado.proyecto_id ?? '';
  if (!partidaId || !proyectoId) {
    await sendTelegramMessage(chatId, 'Sesión expirada. Pulsa «Reportar Avance de Hoy» de nuevo.');
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    return true;
  }

  const cantidad = Number(text.replace(',', '.').trim());
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Envía un número válido (ej: <code>25</code> o <code>12.5</code>).',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const empleado = await empleadoPorTelegramChatId(supabase, chatId);

  try {
    const result = await registrarAvanceDiarioCampo(supabase, {
      proyectoId,
      partidaId,
      perfilId: null,
      empleadoId: empleado?.id ?? null,
      cantidadEjecutadaHoy: cantidad,
      telegramUserId,
    });

    const codigo = String(meta.codigo ?? '');
    const unidad = String(meta.unidad ?? result.unidad);
    const em = emojiEficiencia(result.eficienciaPct);

    await sendTelegramMessage(
      chatId,
      `✅ <b>Avance registrado</b>\n\n` +
        `📌 Partida: <code>${codigo}</code>\n` +
        `📐 Cantidad hoy: <b>${cantidad}</b> ${unidad}\n` +
        `⚡ Eficiencia: <b>${result.eficienciaPct.toFixed(1)}%</b> ${em}\n` +
        `💰 Rentabilidad del día: <b>$${result.rentabilidad_diaria.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>\n\n` +
        `<i>Los datos alimentan el cronograma y la Curva S en el ERP.</i>`,
      { parse_mode: 'HTML' },
    );

    await setTelegramContexto(supabase, chatId, {
      contexto: 'avance_campo',
      metadata: { paso: 'listo' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al guardar';
    await sendTelegramMessage(chatId, `❌ ${msg}`);
  }

  return true;
}

export async function cronFinJornadaAvanceCampo(
  supabase: SupabaseClient,
): Promise<{ enviados: number; omitidos: number }> {
  const { proyectosActivosConIngenieroResidente } = await import(
    '@/lib/campo/ingenieroResidente',
  );
  const obras = await proyectosActivosConIngenieroResidente(supabase);
  let enviados = 0;
  let omitidos = 0;

  for (const a of obras) {
    const chatId = a.ingeniero.telegram_chat_id;
    if (!chatId) {
      omitidos += 1;
      continue;
    }
    try {
      await enviarInvitacionAvanceDiario(
        supabase,
        chatId,
        a.proyecto_id,
        a.proyecto_nombre,
      );
      enviados += 1;
    } catch (e) {
      console.warn('[cron avance campo]', a.proyecto_id, e);
      omitidos += 1;
    }
  }
  return { enviados, omitidos };
}
