import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CLASIFICACIONES_GASTO_ENTIDAD,
  parseClasificacionGastoEntidad,
  type ClasificacionGastoEntidad,
} from '@/lib/contabilidad/clasificacionGastoEntidad';
import { confirmarCompraDesdeCanal } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import { loadProyectosModuloIntegralPorEntidad } from '@/lib/proyectos/proyectosUnificados';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import {
  resumenFacturaCompradorHtml,
  tecladoFacturaRegistradaOk,
} from '@/lib/telegram/mensajesFactura';

export const FLUJO_FACTURA_ENTIDAD = 'factura_compra_entidad';

const PREFIX = 'fe:';
const PICKER_SIZE = 8;

const ETIQUETAS_GASTO_TELEGRAM: Record<ClasificacionGastoEntidad, string> = {
  operacional: 'Gasto operativo',
  administrativo: 'Gasto administrativo',
  servicio: 'Gastos servicios',
};

type EntidadOption = { id: string; nombre: string };

function truncar(s: string, max = 54): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function metaFacturaEntidad(estado: TelegramEstado): {
  flujo?: string;
  paso?: string;
  entidad_id?: string;
  entidad_nombre?: string;
} {
  return (estado.metadata ?? {}) as {
    flujo?: string;
    paso?: string;
    entidad_id?: string;
    entidad_nombre?: string;
  };
}

export function esCallbackFacturaEntidadDestino(data: string): boolean {
  return data.startsWith(PREFIX);
}

async function listarEntidadesActivas(
  supabase: SupabaseClient,
): Promise<EntidadOption[]> {
  const { data: proys, error: pErr } = await supabase
    .from('ci_proyectos')
    .select('entidad_id')
    .not('entidad_id', 'is', null)
    .limit(500);
  if (pErr?.code === '42P01') return [];
  if (pErr) throw new Error(pErr.message);

  const ids = Array.from(
    new Set(
      (proys ?? [])
        .map((r) => String((r as { entidad_id?: string }).entidad_id ?? '').trim())
        .filter(Boolean),
    ),
  );
  if (!ids.length) return [];

  const { data: entidades, error: eErr } = await supabase
    .from('ci_entidades')
    .select('id, nombre')
    .in('id', ids.slice(0, 200))
    .order('nombre');
  if (eErr?.code === '42P01') return [];
  if (eErr) throw new Error(eErr.message);

  return (entidades ?? []).map((e) => ({
    id: String(e.id),
    nombre: String(e.nombre ?? 'Sin nombre').trim() || 'Sin nombre',
  }));
}

export async function enviarPickerEntidadesFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  page = 0,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  const pendingId = estado.pending_factura_id;
  if (!pendingId) {
    await sendTelegramMessage(chatId, '⚠️ Sin factura pendiente. Use /facturas de nuevo.', {
      parse_mode: 'HTML',
    });
    return;
  }

  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: { flujo: FLUJO_FACTURA_ENTIDAD, paso: 'entidad' },
  });

  const entidades = await listarEntidadesActivas(supabase);
  if (!entidades.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay entidades con obras configuradas.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(entidades.length / PICKER_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = entidades.slice(safePage * PICKER_SIZE, safePage * PICKER_SIZE + PICKER_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((e) => [
    { text: truncar(e.nombre), callback_data: `${PREFIX}e:${e.id}` },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}ep:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}ep:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}ep:${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(
    chatId,
    '🏢 <b>¿A qué entidad imputamos esta compra?</b>',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function enviarPickerDestinoFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  entidadId: string,
  entidadNombre: string,
  page = 0,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  const pendingId = estado.pending_factura_id;
  if (!pendingId) {
    await sendTelegramMessage(chatId, '⚠️ Sin factura pendiente. Use /facturas de nuevo.', {
      parse_mode: 'HTML',
    });
    return;
  }

  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: {
      flujo: FLUJO_FACTURA_ENTIDAD,
      paso: 'destino',
      entidad_id: entidadId,
      entidad_nombre: entidadNombre,
    },
  });

  const { proyectos, errors } = await loadProyectosModuloIntegralPorEntidad(supabase, entidadId);
  if (errors.length) {
    await sendTelegramMessage(chatId, `⚠️ ${escHtml(errors[0] ?? 'Error al cargar obras')}`, {
      parse_mode: 'HTML',
    });
    return;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    CLASIFICACIONES_GASTO_ENTIDAD.map((c) => ({
      text: truncar(ETIQUETAS_GASTO_TELEGRAM[c], 28),
      callback_data: `${PREFIX}g:${c}`,
    })),
  ];

  if (proyectos.length) {
    const totalPages = Math.max(1, Math.ceil(proyectos.length / PICKER_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const slice = proyectos.slice(safePage * PICKER_SIZE, safePage * PICKER_SIZE + PICKER_SIZE);

    buttons.push(
      ...slice.map((p) => [
        {
          text: `🏗 ${truncar(p.nombre, 26)}`,
          callback_data: `${PREFIX}p:${p.id}`,
        },
      ]),
    );

    if (totalPages > 1) {
      const nav: Array<{ text: string; callback_data: string }> = [];
      if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}pp:${safePage - 1}` });
      nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}pp:${safePage}` });
      if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}pp:${safePage + 1}` });
      buttons.push(nav);
    }
  }

  const hintObras = proyectos.length
    ? `\n\n<i>O elija una obra de la entidad (${proyectos.length})</i>`
    : '\n\n<i>Esta entidad no tiene obras; use un tipo de gasto OpEx.</i>';

  await sendTelegramMessage(
    chatId,
    `🏢 Entidad: <b>${escHtml(entidadNombre)}</b>\n\n` +
      `¿Imputamos a <b>gasto de entidad</b> (OpEx) o a una <b>obra</b>?` +
      hintObras,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function confirmarGastoEntidadFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  entidadId: string,
  entidadNombre: string,
  clasificacion: ClasificacionGastoEntidad,
): Promise<void> {
  const label = ETIQUETAS_GASTO_TELEGRAM[clasificacion];

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      entidad_id: entidadId,
      proyecto_id: null,
      ubicacion_destino_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  const { data: pendiente } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', pendingId)
    .maybeSingle();
  const extracted = (pendiente?.extracted ?? {}) as Record<string, unknown>;

  let textoFinal =
    `✅ <b>${escHtml(label)}</b>\nEntidad: <b>${escHtml(entidadNombre)}</b>\n\n` +
    resumenFacturaCompradorHtml(extracted);

  try {
    const r = await confirmarCompraDesdeCanal(supabase, {
      pendingId,
      proyectoId: '',
      ubicacionDestinoId: '',
      entidadId,
      imputacionEntidad: true,
      clasificacionGastoEntidad: clasificacion,
    });
    await setTelegramContexto(supabase, chatId, {
      contexto: 'menu',
      pending_factura_id: null,
      metadata: {},
    });
    const msgOk = r.yaExistia
      ? 'Gasto de entidad ya registrado (fuera de valuación AD).'
      : 'Gasto registrado a la entidad — no afecta administración delegada.';
    textoFinal = `✅ <b>${escHtml(label)}</b>\n${escHtml(msgOk)}\n\n` + resumenFacturaCompradorHtml(extracted);
  } catch (e) {
    const det = e instanceof Error ? e.message : 'Error al registrar en Contabilidad';
    textoFinal =
      `⚠️ <b>No se pudo registrar el gasto de entidad</b>\n<i>${escHtml(det.slice(0, 280))}</i>\n\n` +
      resumenFacturaCompradorHtml(extracted);
  }

  await sendTelegramMessage(chatId, textoFinal, {
    parse_mode: 'HTML',
    reply_markup: tecladoFacturaRegistradaOk(),
  });
}

export async function manejarCallbackFacturaEntidadDestinoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackFacturaEntidadDestino(params.data)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  const pendingId = estado.pending_factura_id;
  if (!pendingId) {
    await answerCallbackQuery(params.callbackId, 'Sin factura pendiente', true);
    return true;
  }

  const m = metaFacturaEntidad(estado);

  if (params.data.startsWith(`${PREFIX}ep:`)) {
    const page = Number(params.data.slice(`${PREFIX}ep:`.length));
    if (!Number.isFinite(page) || page < 0) return false;
    await answerCallbackQuery(params.callbackId);
    await enviarPickerEntidadesFacturaTelegram(supabase, params.chatId, Math.floor(page));
    return true;
  }

  if (params.data.startsWith(`${PREFIX}e:`)) {
    const entidadId = params.data.slice(`${PREFIX}e:`.length).trim();
    if (!entidadId) return false;

    const entidades = await listarEntidadesActivas(supabase);
    const hit = entidades.find((e) => e.id === entidadId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Entidad no encontrada', true);
      return true;
    }

    await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        entidad_id: entidadId,
        proyecto_id: null,
        ubicacion_destino_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingId);

    await answerCallbackQuery(params.callbackId, hit.nombre);
    await sendTelegramMessage(
      params.chatId,
      `✅ Entidad: <b>${escHtml(hit.nombre)}</b>`,
      { parse_mode: 'HTML' },
    );
    await enviarPickerDestinoFacturaTelegram(supabase, params.chatId, hit.id, hit.nombre);
    return true;
  }

  if (params.data.startsWith(`${PREFIX}pp:`)) {
    const page = Number(params.data.slice(`${PREFIX}pp:`.length));
    if (!Number.isFinite(page) || page < 0) return false;
    if (!m.entidad_id || !m.entidad_nombre) {
      await answerCallbackQuery(params.callbackId, 'Seleccione entidad primero', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId);
    await enviarPickerDestinoFacturaTelegram(
      supabase,
      params.chatId,
      m.entidad_id,
      m.entidad_nombre,
      Math.floor(page),
    );
    return true;
  }

  if (params.data.startsWith(`${PREFIX}g:`)) {
    const clasificacion = parseClasificacionGastoEntidad(params.data.slice(`${PREFIX}g:`.length));
    if (!clasificacion) return false;
    if (!m.entidad_id || !m.entidad_nombre) {
      await answerCallbackQuery(params.callbackId, 'Seleccione entidad primero', true);
      return true;
    }

    await answerCallbackQuery(params.callbackId, ETIQUETAS_GASTO_TELEGRAM[clasificacion]);
    await confirmarGastoEntidadFacturaTelegram(
      supabase,
      params.chatId,
      pendingId,
      m.entidad_id,
      m.entidad_nombre,
      clasificacion,
    );
    return true;
  }

  if (params.data.startsWith(`${PREFIX}p:`)) {
    const proyectoId = params.data.slice(`${PREFIX}p:`.length).trim();
    if (!proyectoId || !m.entidad_id) {
      await answerCallbackQuery(params.callbackId, 'Seleccione entidad primero', true);
      return true;
    }

    const { proyectos } = await loadProyectosModuloIntegralPorEntidad(supabase, m.entidad_id);
    const hit = proyectos.find((p) => p.id === proyectoId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Obra no encontrada', true);
      return true;
    }

    await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        entidad_id: m.entidad_id,
        proyecto_id: proyectoId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingId);

    await answerCallbackQuery(params.callbackId, hit.nombre);
    const { enviarPickerUbicacionesTelegram } = await import('@/lib/telegram/ubicacionPicker');
    await enviarPickerUbicacionesTelegram(supabase, params.chatId, {
      pendingId,
      proyectoId,
      nombreObra: hit.nombre,
    });
    return true;
  }

  return false;
}
