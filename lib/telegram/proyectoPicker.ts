import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import type { TelegramContexto } from '@/lib/telegram/estados';
import { etiquetaContexto, setTelegramContexto } from '@/lib/telegram/estados';
import { prepararEntradaSalidaTrasObra } from '@/lib/telegram/entradaSalidaRegistro';
import {
  loadCatalogoProyectosApp,
  type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';

/** Contextos en los que el usuario puede elegir proyecto desde Telegram. */
export type ProyectoPickerModo =
  | Extract<
      TelegramContexto,
      'obra' | 'gasto_obra' | 'esperando_audio_bitacora' | 'entrada_obra' | 'salida_obra' | 'memoria_obra'
    >
  | 'factura_compra';

const PAGE_SIZE = 8;

const MODO_CORTO: Record<ProyectoPickerModo, string> = {
  obra: 'o',
  gasto_obra: 'g',
  esperando_audio_bitacora: 'b',
  entrada_obra: 'n',
  salida_obra: 'l',
  memoria_obra: 'm',
  factura_compra: 'f',
};

const MODO_LARGO: Record<string, ProyectoPickerModo> = {
  o: 'obra',
  g: 'gasto_obra',
  b: 'esperando_audio_bitacora',
  n: 'entrada_obra',
  l: 'salida_obra',
  m: 'memoria_obra',
  f: 'factura_compra',
};

function truncarNombre(nombre: string, max = 28): string {
  const t = nombre.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function callbackProyectoSeleccion(modo: ProyectoPickerModo, proyectoId: string): string {
  return `ps:${MODO_CORTO[modo]}:${proyectoId}`;
}

export function callbackProyectoPagina(modo: ProyectoPickerModo, page: number): string {
  return `pp:${MODO_CORTO[modo]}:${page}`;
}

export function parseCallbackProyecto(data: string):
  | { type: 'sel'; modo: ProyectoPickerModo; proyectoId: string }
  | { type: 'page'; modo: ProyectoPickerModo; page: number }
  | null {
  if (data.startsWith('ps:')) {
    const [, modoCorto, uuid] = data.split(':');
    const modo = MODO_LARGO[modoCorto ?? ''];
    if (!modo || !uuid || !isValidProyectoUuid(uuid)) return null;
    return { type: 'sel', modo, proyectoId: uuid };
  }
  if (data.startsWith('pp:')) {
    const [, modoCorto, pageStr] = data.split(':');
    const modo = MODO_LARGO[modoCorto ?? ''];
    const page = Number(pageStr);
    if (!modo || !Number.isFinite(page) || page < 0) return null;
    return { type: 'page', modo, page: Math.floor(page) };
  }
  return null;
}

function tituloPicker(modo: ProyectoPickerModo): string {
  switch (modo) {
    case 'obra':
      return '🏗 <b>Elige la obra</b> (fotos y evidencia):';
    case 'gasto_obra':
      return '💸 <b>Elige la obra</b> para el gasto:';
    case 'esperando_audio_bitacora':
      return '📋 <b>Elige la obra</b> para la bitácora:';
    case 'entrada_obra':
      return '📥 <b>Elige la obra</b> (entrada de material):';
    case 'salida_obra':
      return '📤 <b>Elige la obra</b> (salida de material):';
    case 'factura_compra':
      return '🏗 <b>Elige la obra</b> de esta compra:';
    case 'memoria_obra':
      return '📸 <b>Elige la obra</b> para memoria descriptiva de avance:';
  }
}

function mensajeTrasSeleccion(modo: ProyectoPickerModo, nombre: string): string {
  switch (modo) {
    case 'obra':
      return (
        `✅ Obra: <b>${nombre}</b>\n\n` +
        'Modo <b>evidencia de obra</b> activo. Envía fotos (avance, planos, etc.).\n' +
        'También puedes usar /gasto o /bitacora con este proyecto.'
      );
    case 'gasto_obra':
      return (
        `✅ Obra: <b>${nombre}</b>\n\n` +
        'Modo <b>gasto de obra</b>. Envía foto del comprobante; Gemini extraerá monto y proveedor.'
      );
    case 'esperando_audio_bitacora':
      return (
        `✅ Obra: <b>${nombre}</b>\n\n` +
        'Envía una <b>nota de voz</b> con el reporte de bitácora de campo.'
      );
    case 'entrada_obra':
    case 'salida_obra':
      return '';
    case 'factura_compra':
      return '';
    case 'memoria_obra':
      return '';
  }
}

function buildKeyboard(
  proyectos: ProyectoCatalogo[],
  page: number,
  modo: ProyectoPickerModo,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const totalPages = Math.max(1, Math.ceil(proyectos.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = proyectos.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => [
    {
      text: truncarNombre(p.nombre),
      callback_data: callbackProyectoSeleccion(modo, p.id),
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      nav.push({
        text: '◀ Anterior',
        callback_data: callbackProyectoPagina(modo, safePage - 1),
      });
    }
    nav.push({
      text: `${safePage + 1} / ${totalPages}`,
      callback_data: callbackProyectoPagina(modo, safePage),
    });
    if (safePage < totalPages - 1) {
      nav.push({
        text: 'Siguiente ▶',
        callback_data: callbackProyectoPagina(modo, safePage + 1),
      });
    }
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}

export async function enviarPickerProyectosTelegram(
  supabase: SupabaseClient,
  chatId: string,
  modo: ProyectoPickerModo,
  page = 0,
): Promise<void> {
  const { proyectos, error } = await loadCatalogoProyectosApp(supabase);
  if (error) {
    await sendTelegramMessage(
      chatId,
      `❌ No se pudieron cargar proyectos: ${error}`,
      { parse_mode: 'HTML' },
    );
    return;
  }
  if (proyectos.length === 0) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay proyectos en el sistema. Crea uno en la app web primero.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const keyboard = buildKeyboard(proyectos, page, modo);
  const totalPages = Math.max(1, Math.ceil(proyectos.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  await sendTelegramMessage(
    chatId,
    `${tituloPicker(modo)}\n<i>Toca un nombre abajo (${proyectos.length} proyectos)</i>`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );

  if (safePage !== page) {
    /* página ajustada por límites */
  }
}

export async function manejarCallbackProyectoTelegram(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    callbackId: string;
    data: string;
  },
): Promise<boolean> {
  const parsed = parseCallbackProyecto(params.data);
  if (!parsed) return false;

  if (parsed.type === 'page') {
    await answerCallbackQuery(params.callbackId);
    await enviarPickerProyectosTelegram(supabase, params.chatId, parsed.modo, parsed.page);
    return true;
  }

  const { proyectos } = await loadCatalogoProyectosApp(supabase);
  const hit = proyectos.find((p) => p.id === parsed.proyectoId);
  if (!hit) {
    await answerCallbackQuery(params.callbackId, 'Proyecto no encontrado', true);
    return true;
  }

  if (parsed.modo === 'factura_compra') {
    const estado = await import('@/lib/telegram/estados').then((m) =>
      m.getTelegramEstado(supabase, params.chatId),
    );
    const pendingId = estado.pending_factura_id;
    if (!pendingId) {
      await answerCallbackQuery(params.callbackId, 'Sin factura pendiente', true);
      return true;
    }
    await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        proyecto_id: parsed.proyectoId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingId);
    await answerCallbackQuery(params.callbackId, `Obra: ${hit.nombre}`);
    const { enviarPickerUbicacionesTelegram } = await import('@/lib/telegram/ubicacionPicker');
    await enviarPickerUbicacionesTelegram(supabase, params.chatId, {
      pendingId,
      proyectoId: parsed.proyectoId,
      nombreObra: hit.nombre,
    });
    return true;
  }

  if (parsed.modo === 'entrada_obra' || parsed.modo === 'salida_obra') {
    const tipo = parsed.modo === 'entrada_obra' ? 'entrada' : 'salida';
    await prepararEntradaSalidaTrasObra(
      supabase,
      params.chatId,
      parsed.proyectoId,
      tipo,
    );
    await answerCallbackQuery(params.callbackId, `Obra: ${hit.nombre}`);
    return true;
  }

  if (parsed.modo === 'memoria_obra') {
    await answerCallbackQuery(params.callbackId, `Obra: ${hit.nombre}`);
    const { enviarPickerPartidasMemoriaObra } = await import('@/lib/telegram/memoriaObra');
    await enviarPickerPartidasMemoriaObra(supabase, params.chatId, parsed.proyectoId);
    return true;
  }

  await setTelegramContexto(supabase, params.chatId, {
    contexto: parsed.modo,
    proyecto_id: parsed.proyectoId,
  });

  await answerCallbackQuery(params.callbackId, `Obra: ${hit.nombre}`);
  const msg = mensajeTrasSeleccion(parsed.modo, hit.nombre);
  if (msg) {
    await sendTelegramMessage(params.chatId, msg, { parse_mode: 'HTML' });
  }
  return true;
}

/** Resumen legible del proyecto activo para /estado. */
export async function nombreProyectoTelegram(
  supabase: SupabaseClient,
  proyectoId: string | null,
): Promise<string | null> {
  if (!proyectoId) return null;
  const { data } = await supabase
    .from('ci_proyectos')
    .select('nombre')
    .eq('id', proyectoId)
    .maybeSingle();
  const nombre = data?.nombre?.trim();
  return nombre || null;
}

export function hintElegirProyecto(): string {
  return 'Usa <code>/obra</code> o <code>/proyecto</code> para elegir la obra desde una lista.';
}
