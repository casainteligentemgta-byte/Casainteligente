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
import {
  PRC_MAT_BUSCAR,
  PRC_MAT_CAT,
  PRC_MAT_OTRO,
  PRC_MAT_PAGE_PREFIX,
  PRC_MAT_PREFIX,
  PRC_MAT_TXT_OK,
  PRC_SRCH_PAGE_PREFIX,
  aplicarMaterialCatalogoProcura,
  buscarYMostrarMaterialesProcura,
  confirmarTextoLibreMaterialProcura,
  enviarBusquedaMaterialProcura,
  enviarPickerMaterialProcura,
  enviarTextoLibreMaterialProcura,
  resolverMaterialProcuraPorId,
} from '@/lib/telegram/procuraMaterialPicker';
import { enviarPickerProyectosTelegram, nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';

const PREFIX = 'prc:';
const CB_CONFIRM = `${PREFIX}ok`;
const CB_CANCEL = `${PREFIX}no`;
const CB_UNIDAD = `${PREFIX}u:`;
const CB_UNIDAD_PAGE = `${PREFIX}pg:`;

export type PasoProcuraTelegram =
  | 'material_elegir'
  | 'material_buscar'
  | 'material_libre'
  | 'cantidad'
  | 'unidad'
  | 'observaciones';

export type MetadataProcuraTelegram = {
  paso?: PasoProcuraTelegram;
  material_id?: string;
  material_txt?: string;
  cantidad?: number;
  unidad?: string;
  observaciones?: string;
  nombre_obra?: string;
  busqueda_material?: string;
  texto_libre_borrador?: string;
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const MENSAJE_PROCURA_LEGACY_DESHABILITADA =
  '⚠️ <b>Acceso Denegado</b>\n\n' +
  'El formato de solicitudes de procura por proyecto antiguo ha sido deshabilitado en producción. ' +
  'Por favor, utiliza el nuevo comando /procura para gestionar las solicitudes por el departamento de compras de la empresa.';

export function procuraLegacyDeshabilitadaEnProduccion(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** H-13: bloquea flujo legacy por proyecto en producción antes de mutar ci_telegram_estados. */
async function bloquearProcuraLegacyEnProduccion(
  supabase: SupabaseClient,
  chatId: string,
  opts?: { callbackId?: string },
): Promise<boolean> {
  if (!procuraLegacyDeshabilitadaEnProduccion()) return false;

  const estado = await getTelegramEstado(supabase, chatId);
  if (esFlujoProcuraTelegram(estado)) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
  }

  if (opts?.callbackId) {
    await answerCallbackQuery(opts.callbackId, 'Acceso denegado', true);
  }

  await sendTelegramMessage(chatId, MENSAJE_PROCURA_LEGACY_DESHABILITADA, { parse_mode: 'HTML' });
  return true;
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
    `4️⃣ <b>Observaciones</b> (opcional).\n` +
      `Escribe una nota o envía <code>-</code> para omitir.`,
    { parse_mode: 'HTML' },
  );
}

async function enviarPickerUnidadProcura(chatId: string, cantidad: number, page = 0): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `3️⃣ Cantidad: <b>${cantidad.toLocaleString('es-VE')}</b>\n\n` +
      `Elige la <b>unidad de medida</b>:\n` +
      `<i>También puedes escribir, ej. M3, Litros, Pulgadas</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: tecladoUnidadesProcuraPagina(CB_UNIDAD, page, CB_UNIDAD_PAGE),
    },
  );
}

async function pedirCantidadProcura(chatId: string, materialTxt: string, unidadHint?: string): Promise<void> {
  const unidadLine = unidadHint
    ? `Unidad sugerida: <b>${escHtml(unidadHint)}</b>\n\n`
    : '';
  await sendTelegramMessage(
    chatId,
    `📦 Material: <b>${escHtml(materialTxt)}</b>\n` +
      unidadLine +
      `2️⃣ Indica la <b>cantidad</b> (y unidad opcional).\n` +
      `<i>Ej.: 50 SAC · 2.5 M3 · 100 Mts · 20 Litros · 10</i>`,
    { parse_mode: 'HTML' },
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
  if (await bloquearProcuraLegacyEnProduccion(supabase, chatId)) return;

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
  if (await bloquearProcuraLegacyEnProduccion(supabase, chatId)) return;

  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await setTelegramContexto(supabase, chatId, {
    contexto: 'procura_solicitud',
    proyecto_id: proyectoId,
    reemplazarMetadata: true,
    metadata: {
      paso: 'material_elegir',
      nombre_obra: nombre,
    },
  });
  await sendTelegramMessage(
    chatId,
    `📦 <b>Solicitud de procura</b>\n\nObra: <b>${escHtml(nombre)}</b>`,
    { parse_mode: 'HTML' },
  );
  await enviarPickerMaterialProcura(supabase, chatId, proyectoId);
}

async function enviarResumenConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = metaProcura(estado);
  const nombreObra = m.nombre_obra ?? (await nombreProyectoTelegram(supabase, estado.proyecto_id)) ?? '—';
  const solicitante = await resolverSolicitanteDesdeTelegram(supabase, chatId);
  const catalogo = m.material_id ? '\n<i>Vinculado al catálogo</i>' : '';
  await sendTelegramMessage(
    chatId,
    `📋 <b>Confirma la procura</b>\n\n` +
      `👤 Solicita: <b>${escHtml(solicitante.nombre)}</b>\n` +
      `🏗 Obra: <b>${escHtml(nombreObra)}</b>\n` +
      `📦 Material: <b>${escHtml(m.material_txt ?? '—')}</b>${catalogo}\n` +
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
      material_id: m.material_id?.trim() || null,
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
    const hint = /ci_procuras/i.test(error.message)
      ? '\n\n<i>Verifique migraciones 224/225 y ejecute:</i>\n<code>notify pgrst, \'reload schema\';</code>'
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
  if (await bloquearProcuraLegacyEnProduccion(supabase, chatId)) return true;

  const t = texto.trim();
  if (!t) {
    await sendTelegramMessage(chatId, '⚠️ Escribe un texto válido o usa /cancelar.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  const m = metaProcura(estado);
  const paso = m.paso ?? 'material_elegir';

  if (paso === 'material_buscar' || paso === 'material_libre' || paso === 'material_elegir') {
    return buscarYMostrarMaterialesProcura(supabase, chatId, estado, t, {
      modoLibre: paso === 'material_libre',
    });
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
      const unidadSugerida = m.unidad ? normalizarUnidadProcura(m.unidad) : null;
      if (unidadSugerida) {
        await patchMeta(supabase, chatId, estado, {
          paso: 'observaciones',
          cantidad: parsed.cantidad,
          unidad: unidadSugerida,
        });
        await pedirObservacionesProcura(chatId);
        return true;
      }
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
  if (await bloquearProcuraLegacyEnProduccion(supabase, params.chatId, { callbackId: params.callbackId })) {
    return true;
  }

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoProcuraTelegram(estado)) {
    await answerCallbackQuery(params.callbackId, 'Sesión expirada', true);
    return true;
  }

  const proyectoId = estado.proyecto_id?.trim();
  if (!proyectoId) {
    await answerCallbackQuery(params.callbackId, 'Sin obra', true);
    return true;
  }

  if (params.data.startsWith(PRC_SRCH_PAGE_PREFIX)) {
    const page = Number(params.data.slice(PRC_SRCH_PAGE_PREFIX.length));
    const m = metaProcura(estado);
    const term = m.busqueda_material?.trim() ?? '';
    if (!term) {
      await answerCallbackQuery(params.callbackId, 'Sin búsqueda activa', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId);
    await buscarYMostrarMaterialesProcura(supabase, params.chatId, estado, term, {
      page: Number.isFinite(page) ? page : 0,
      modoLibre: Boolean(m.texto_libre_borrador?.trim()),
    });
    return true;
  }

  if (params.data === PRC_MAT_TXT_OK) {
    const m = metaProcura(estado);
    const txt = (m.texto_libre_borrador || m.busqueda_material || '').trim();
    await answerCallbackQuery(params.callbackId, 'Texto libre');
    await confirmarTextoLibreMaterialProcura(supabase, params.chatId, estado, txt);
    return true;
  }

  if (params.data.startsWith(PRC_MAT_PAGE_PREFIX)) {
    const page = Number(params.data.slice(PRC_MAT_PAGE_PREFIX.length));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerMaterialProcura(supabase, params.chatId, proyectoId, page);
    return true;
  }

  if (params.data === PRC_MAT_BUSCAR) {
    await answerCallbackQuery(params.callbackId, 'Buscar');
    await patchMeta(supabase, params.chatId, estado, { paso: 'material_buscar' });
    await enviarBusquedaMaterialProcura(params.chatId);
    return true;
  }

  if (params.data === PRC_MAT_OTRO) {
    await answerCallbackQuery(params.callbackId, 'Texto libre');
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'material_libre',
      material_id: '',
    });
    await enviarTextoLibreMaterialProcura(params.chatId);
    return true;
  }

  if (params.data === PRC_MAT_CAT) {
    await answerCallbackQuery(params.callbackId);
    await enviarPickerMaterialProcura(supabase, params.chatId, proyectoId);
    return true;
  }

  if (params.data.startsWith(PRC_MAT_PREFIX)) {
    const materialId = params.data.slice(PRC_MAT_PREFIX.length).trim();
    const material = await resolverMaterialProcuraPorId(supabase, materialId, proyectoId);
    if (!material) {
      await answerCallbackQuery(params.callbackId, 'Material no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, material.name.slice(0, 40));
    await aplicarMaterialCatalogoProcura(supabase, params.chatId, estado, material);
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
    const fresh = await getTelegramEstado(supabase, params.chatId);
    if (!esFlujoProcuraTelegram(fresh)) {
      await sendTelegramMessage(
        params.chatId,
        '⚠️ La sesión expiró. Usa <code>/procura</code> de nuevo.',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await registrarProcuraTelegram(supabase, params.chatId, fresh);
    return true;
  }

  return false;
}
