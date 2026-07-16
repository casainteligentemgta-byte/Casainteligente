import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { crearCapituloObra, etiquetaCapituloObra, listarCapitulosObra } from '@/lib/almacen/capitulosObra';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { mensajeObraListaEntradaSalida } from '@/lib/telegram/mensajesEntradaSalida';
import { nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';

const PREFIX_SEL = 'sc:';
const PREFIX_NUEVO = 'scn';
const PREFIX_PAGE = 'scp:';
const PAGE_SIZE = 8;

function truncar(s: string, max = 56): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function esCallbackSalidaCapitulo(data: string): boolean {
  return data.startsWith(PREFIX_SEL) || data.startsWith(PREFIX_NUEVO) || data.startsWith(PREFIX_PAGE);
}

export function parseCallbackSalidaCapitulo(data: string):
  | { type: 'sel'; capituloId: string }
  | { type: 'nuevo' }
  | { type: 'page'; page: number }
  | null {
  if (data === PREFIX_NUEVO) return { type: 'nuevo' };
  if (data.startsWith(PREFIX_SEL)) {
    const id = data.slice(PREFIX_SEL.length);
    return id ? { type: 'sel', capituloId: id } : null;
  }
  if (data.startsWith(PREFIX_PAGE)) {
    const page = Number(data.slice(PREFIX_PAGE.length));
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'page', page: Math.floor(page) };
  }
  return null;
}

function buildKeyboard(
  capitulos: Array<{ id: string; codigo: string; nombre: string }>,
  page: number,
) {
  const totalPages = Math.max(1, Math.ceil(capitulos.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = capitulos.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '➕ Crear capítulo nuevo', callback_data: PREFIX_NUEVO }],
    ...slice.map((c) => [
      {
        text: truncar(etiquetaCapituloObra(c)),
        callback_data: `${PREFIX_SEL}${c.id}`,
      },
    ]),
  ];

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX_PAGE}${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_PAGE}${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX_PAGE}${safePage + 1}` });
    buttons.push(nav);
  }

  return { inline_keyboard: buttons };
}

/** Tras elegir obra en /salida: picker de capítulo presupuestario. */
export async function enviarPickerCapitulosSalidaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  page = 0,
): Promise<void> {
  const capitulos = await listarCapitulosObra(supabase, proyectoId, 48);
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';

  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: proyectoId,
    metadata: {
      paso: 'capitulo',
      tipo_movimiento: 'salida',
    },
  });

  if (!capitulos.length) {
    await sendTelegramMessage(
      chatId,
      `📤 Obra: <b>${nombre}</b>\n\n` +
        'No hay capítulos en presupuesto. Pulsa <b>Crear capítulo nuevo</b> o escribe el título\n' +
        '(ej. <code>03 Instalación eléctrica</code>).',
      { parse_mode: 'HTML', reply_markup: buildKeyboard([], 0) },
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    `📤 Obra: <b>${nombre}</b>\n\n` +
      'Elige el <b>capítulo</b> al que corresponde el material que egresa:',
    { parse_mode: 'HTML', reply_markup: buildKeyboard(capitulos, page) },
  );
}

async function continuarTrasCapitulo(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  capituloId: string,
  capituloLabel: string,
): Promise<void> {
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: proyectoId,
    metadata: {
      paso: 'foto',
      tipo_movimiento: 'salida',
      capitulo_id: capituloId,
      capitulo_nombre: capituloLabel,
    },
  });
  await sendTelegramMessage(
    chatId,
    `📂 Capítulo: <b>${capituloLabel}</b>\n\n${mensajeObraListaEntradaSalida('salida', nombre)}`,
    { parse_mode: 'HTML' },
  );
}

export async function manejarCallbackSalidaCapituloTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const parsed = parseCallbackSalidaCapitulo(params.data);
  if (!parsed) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  const proyectoId = estado.proyecto_id;
  if (!proyectoId) {
    await answerCallbackQuery(params.callbackId, 'Elige la obra primero', true);
    return true;
  }

  if (parsed.type === 'page') {
    await answerCallbackQuery(params.callbackId);
    await enviarPickerCapitulosSalidaTelegram(supabase, params.chatId, proyectoId, parsed.page);
    return true;
  }

  if (parsed.type === 'nuevo') {
    await setTelegramContexto(supabase, params.chatId, {
      metadata: {
        ...((estado.metadata ?? {}) as Record<string, unknown>),
        paso: 'nuevo_capitulo',
        tipo_movimiento: 'salida',
      },
    });
    await answerCallbackQuery(params.callbackId);
    await sendTelegramMessage(
      params.chatId,
      '✏️ Escribe el <b>título del capítulo</b>.\n\n' +
        'Opcional: incluye número al inicio, ej.\n' +
        '<code>04 Redes y comunicaciones</code>',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const { data: cap } = await supabase
    .from('capitulos')
    .select('id, codigo, nombre')
    .eq('id', parsed.capituloId)
    .maybeSingle();

  if (!cap?.id) {
    await answerCallbackQuery(params.callbackId, 'Capítulo no encontrado', true);
    return true;
  }

  const label = etiquetaCapituloObra({
    codigo: String(cap.codigo ?? ''),
    nombre: String(cap.nombre ?? ''),
  });
  await answerCallbackQuery(params.callbackId, label);
  await continuarTrasCapitulo(supabase, params.chatId, proyectoId, String(cap.id), label);
  return true;
}

export async function manejarTextoNuevoCapituloSalida(params: {
  supabase: SupabaseClient;
  chatId: string;
  texto: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (estado.contexto !== 'salida_obra') return false;
  const paso = String((estado.metadata ?? {}).paso ?? '');
  if (paso !== 'nuevo_capitulo' || !estado.proyecto_id) return false;

  try {
    const cap = await crearCapituloObra(params.supabase, {
      proyectoId: estado.proyecto_id,
      titulo: params.texto,
    });
    const label = etiquetaCapituloObra({
      codigo: String(cap.codigo ?? ''),
      nombre: String(cap.nombre ?? ''),
    });
    await sendTelegramMessage(
      params.chatId,
      `✅ Capítulo creado: <b>${label}</b>`,
      { parse_mode: 'HTML' },
    );
    await continuarTrasCapitulo(
      params.supabase,
      params.chatId,
      estado.proyecto_id,
      cap.id,
      label,
    );
    return true;
  } catch (e) {
    await sendTelegramMessage(
      params.chatId,
      `❌ ${e instanceof Error ? e.message : 'No se pudo crear el capítulo'}`,
      { parse_mode: 'HTML' },
    );
    return true;
  }
}
