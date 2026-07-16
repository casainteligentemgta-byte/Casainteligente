import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import {
  etiquetaUbicacionSelector,
  listarUbicacionesParaSelector,
} from '@/lib/almacen/ubicacionesInventario';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import type { UbicacionInventario } from '@/types/inventario-obra';

const PREFIX_SEL = 'so:';
const PREFIX_PAGE = 'sop:';
const PAGE_SIZE = 8;

function truncar(s: string, max = 60): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function esCallbackSalidaOrigen(data: string): boolean {
  return data.startsWith(PREFIX_SEL) || data.startsWith(PREFIX_PAGE);
}

export function parseCallbackSalidaOrigen(data: string):
  | { type: 'sel'; ubicacionId: string }
  | { type: 'page'; page: number }
  | null {
  if (data.startsWith(PREFIX_SEL)) {
    const ubicacionId = data.slice(PREFIX_SEL.length);
    return ubicacionId ? { type: 'sel', ubicacionId } : null;
  }
  if (data.startsWith(PREFIX_PAGE)) {
    const page = Number(data.slice(PREFIX_PAGE.length));
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'page', page: Math.floor(page) };
  }
  return null;
}

function indentNivel(u: UbicacionInventario, flat: UbicacionInventario[]): number {
  let n = 0;
  let pid = u.ubicacion_padre_id;
  const byId = new Map(flat.map((x) => [x.id, x]));
  while (pid && n < 5) {
    n += 1;
    pid = byId.get(pid)?.ubicacion_padre_id;
  }
  return n;
}

function buildKeyboard(
  ubicaciones: UbicacionInventario[],
  page: number,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const totalPages = Math.max(1, Math.ceil(ubicaciones.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = ubicaciones.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => [
    {
      text: truncar(etiquetaUbicacionSelector(u, indentNivel(u, ubicaciones))),
      callback_data: `${PREFIX_SEL}${u.id}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX_PAGE}${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_PAGE}${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX_PAGE}${safePage + 1}` });
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}

async function listarAlmacenesOrigen(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<UbicacionInventario[]> {
  const ubicaciones = await listarUbicacionesParaSelector(supabase, { proyectoId });
  return ubicaciones.filter(
    (u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil',
  );
}

export async function hayAlmacenesOrigenSalida(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<boolean> {
  const list = await listarAlmacenesOrigen(supabase, proyectoId);
  return list.length > 0;
}

/** Tras OCR + observación: elige almacén de donde sale el material. */
export async function enviarPickerOrigenSalidaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  params: { proyectoId: string; nombreObra: string; nMateriales: number; page?: number },
): Promise<void> {
  const ubicaciones = await listarAlmacenesOrigen(supabase, params.proyectoId);

  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    metadata: { paso: 'origen' },
  });

  if (!ubicaciones.length) {
    return;
  }

  const keyboard = buildKeyboard(ubicaciones, params.page ?? 0);
  await sendTelegramMessage(
    chatId,
    `📦 <b>¿De qué almacén sale el material?</b>\n` +
      `Obra: <b>${params.nombreObra}</b>\n` +
      `Materiales detectados: <b>${params.nMateriales}</b>\n\n` +
      '<i>Se descontará stock y se registrará transferencia a la obra.</i>',
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

export type CallbackSalidaOrigenHandler = (
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; origenUbicacionId: string },
) => Promise<void>;

export async function manejarCallbackSalidaOrigenTelegram(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    callbackId: string;
    data: string;
    onOrigenSeleccionado: CallbackSalidaOrigenHandler;
  },
): Promise<boolean> {
  const parsed = parseCallbackSalidaOrigen(params.data);
  if (!parsed) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (estado.contexto !== 'salida_obra' || String(estado.metadata?.paso ?? '') !== 'origen') {
    await answerCallbackQuery(params.callbackId, 'Flujo de salida no activo', true);
    return true;
  }

  const proyectoId = estado.proyecto_id;
  if (!proyectoId) {
    await answerCallbackQuery(params.callbackId, 'Elige la obra primero', true);
    return true;
  }

  if (parsed.type === 'page') {
    await answerCallbackQuery(params.callbackId);
    const nombreObra = String(estado.metadata?.nombre_obra ?? 'Obra');
    const nMateriales = Number(estado.metadata?.n_materiales_match ?? 0);
    await enviarPickerOrigenSalidaTelegram(supabase, params.chatId, {
      proyectoId,
      nombreObra,
      nMateriales,
      page: parsed.page,
    });
    return true;
  }

  const { data: ubi } = await supabase
    .from('inv_ubicaciones')
    .select('id, nombre, tipo')
    .eq('id', parsed.ubicacionId)
    .maybeSingle();

  if (!ubi?.id) {
    await answerCallbackQuery(params.callbackId, 'Ubicación no encontrada', true);
    return true;
  }

  if (ubi.tipo !== 'almacen_central' && ubi.tipo !== 'almacen_movil') {
    await answerCallbackQuery(params.callbackId, 'Elige un almacén central o móvil', true);
    return true;
  }

  await answerCallbackQuery(params.callbackId, String(ubi.nombre));
  await params.onOrigenSeleccionado(supabase, {
    chatId: params.chatId,
    callbackId: params.callbackId,
    data: params.data,
    origenUbicacionId: String(ubi.id),
  });
  return true;
}
