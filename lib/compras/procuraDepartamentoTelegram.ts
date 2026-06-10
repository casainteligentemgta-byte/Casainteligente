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
  etiquetaCapituloMaestro,
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
  limiteViaRapidaUsd,
  parsePrioridadProcura,
  type PrioridadProcura,
} from '@/lib/compras/viaRapidaProcura';
import {
  buscarMaterialesFuzzyCatalogo,
  etiquetaMaterialCatalogo,
} from '@/lib/almacen/buscarMaterialesCatalogo';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import { marcarTtlPendienteAtomico } from '@/lib/compras/telegramTtlAtomico';
import { normalizarUnidadProcura, parseCantidadUnidadProcura } from '@/lib/procuras/unidadesProcura';
import { resolverMaterialProcuraPorId } from '@/lib/telegram/procuraMaterialPicker';
import {
  callbackDataTelegramValido,
  esUuidProcura,
  parseMetadataProcuraDepartamento,
  type MetadataProcuraDepartamentoParsed,
} from '@/lib/compras/telegramMetadata';

const PREFIX = 'cmp:';
const CB_CAP = `${PREFIX}cap:`;
const CB_MAT_ID = `${PREFIX}mat_id:`;
const CB_MAT_TXT = `${PREFIX}mat:txt`;
const CB_PRI = `${PREFIX}pri:`;
const CB_CONS = `${PREFIX}cons:`;
const CB_OK = `${PREFIX}ok`;
const CB_NO = `${PREFIX}no`;
const CB_MONTO_SKIP = `${PREFIX}monto:skip`;
const CB_STATE_RESUME = `${PREFIX}state:resume`;
const CB_STATE_RESET = `${PREFIX}state:reset`;
const MIN_CHARS_BUSQUEDA_MATERIAL = 3;
const PREFIJO_POR_VERIFICAR = '[POR VERIFICAR]';

/** TTL de sesión procura departamento (caídas de señal Margarita / interior). */
export const TTL_PROCURA_DEPARTAMENTO_MS = 2 * 60 * 60 * 1000;

export type PasoProcuraDepartamento =
  | 'capitulo'
  | 'material'
  | 'cantidad'
  | 'prioridad'
  | 'consumible'
  | 'monto'
  | 'confirm';

export type MetadataProcuraDepartamento = MetadataProcuraDepartamentoParsed;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncarBoton(s: string, max = 56): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function pedirCantidadMaterial(
  chatId: string,
  materialTxt: string,
  unidadSugerida?: string,
): Promise<void> {
  const unidadHint = unidadSugerida
    ? `\nUnidad catálogo: <b>${escHtml(unidadSugerida)}</b>`
    : '';
  await sendTelegramMessage(
    chatId,
    `📦 Material: <b>${escHtml(materialTxt)}</b>${unidadHint}\n\n` +
      `3️⃣ Indica <b>cantidad</b> y unidad (ej. <code>50 SAC</code>, <code>2.5 M3</code>):`,
    { parse_mode: 'HTML' },
  );
}

async function mostrarCoincidenciasMaterial(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  term: string,
): Promise<void> {
  const t = term.trim();
  await patchMeta(supabase, chatId, estado, { material_busqueda_borrador: t });

  let materiales: Awaited<ReturnType<typeof buscarMaterialesFuzzyCatalogo>>;
  try {
    materiales = await buscarMaterialesFuzzyCatalogo(supabase, t, { limit: 5 });
  } catch (e) {
    await sendTelegramMessage(
      chatId,
      `❌ Error al buscar materiales: ${escHtml(e instanceof Error ? e.message : 'Error')}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const m of materiales) {
    const callback_data = `${CB_MAT_ID}${m.id}`;
    if (!callbackDataTelegramValido(callback_data)) continue;
    buttons.push([
      {
        text: truncarBoton(etiquetaMaterialCatalogo(m)),
        callback_data,
      },
    ]);
  }

  buttons.push([
    {
      text: '➕ Usar texto libre escrito',
      callback_data: CB_MAT_TXT,
    },
  ]);

  const sinResultados =
    materiales.length === 0
      ? '\n\n<i>No hay coincidencias en catálogo. Puedes usar tu texto libre.</i>'
      : '';

  await sendTelegramMessage(
    chatId,
    `🔍 Coincidencias para «<b>${escHtml(t)}</b>» (${materiales.length}):${sinResultados}\n` +
      'Elige un material del catálogo o confirma tu descripción:',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    },
  );
}

function meta(estado: TelegramEstado): MetadataProcuraDepartamento {
  return parseMetadataProcuraDepartamento(estado);
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

export function estadoProcuraDepartamentoExpirado(estado: TelegramEstado): boolean {
  if (!estado.updated_at) return false;
  const updated = new Date(estado.updated_at).getTime();
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated > TTL_PROCURA_DEPARTAMENTO_MS;
}

function tieneProgresoParcialProcura(m: MetadataProcuraDepartamento): boolean {
  if (m.material_txt?.trim() || m.material_busqueda_borrador?.trim()) return true;
  if (m.capitulo_id?.trim() || m.capitulo_codigo?.trim()) return true;
  if (m.cantidad != null && Number.isFinite(m.cantidad)) return true;
  const paso = m.paso ?? 'capitulo';
  return paso !== 'capitulo';
}

function resumenSolicitudProcuraDepartamento(m: MetadataProcuraDepartamento): string {
  const material =
    m.material_txt?.trim() ||
    m.material_busqueda_borrador?.trim() ||
    null;
  if (material) return material.slice(0, 120);
  if (m.capitulo_nombre?.trim() || m.capitulo_codigo?.trim()) {
    return etiquetaCapituloMaestro({
      codigo: m.capitulo_codigo ?? '',
      nombre: m.capitulo_nombre ?? '',
    }).slice(0, 120);
  }
  return 'procura sin confirmar';
}

async function enviarPromptTtlProcuraDepartamento(
  chatId: string,
  resumen: string,
): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `⚠️ Tenías una solicitud a medias de <b>${escHtml(resumen)}</b>.\n\n` +
      '¿Deseas continuar donde quedaste o iniciar una nueva?',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '▶️ Continuar solicitud', callback_data: CB_STATE_RESUME },
            { text: '🆕 Iniciar nueva', callback_data: CB_STATE_RESET },
          ],
        ],
      },
    },
  );
}

async function renderizarPasoProcuraDepartamento(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  const paso = m.paso ?? 'capitulo';

  switch (paso) {
    case 'capitulo': {
      const capitulos = await listarCapitulosMaestro(supabase);
      await sendTelegramMessage(
        chatId,
        `📦 <b>Procura en curso</b>\n\n1️⃣ Elige el <b>capítulo</b> de obra:`,
        {
          parse_mode: 'HTML',
          reply_markup: tecladoCapitulosMaestro(capitulos, CB_CAP),
        },
      );
      return;
    }
    case 'material':
      if (m.capitulo_codigo && m.capitulo_nombre) {
        await pedirMaterial(chatId, {
          codigo: m.capitulo_codigo,
          nombre: m.capitulo_nombre,
        });
      } else {
        await sendTelegramMessage(
          chatId,
          '2️⃣ Escribe al menos <b>3 letras</b> del material para buscar en catálogo.',
          { parse_mode: 'HTML' },
        );
      }
      return;
    case 'cantidad':
      if (m.material_txt?.trim()) {
        await pedirCantidadMaterial(chatId, m.material_txt, m.unidad);
      } else {
        await sendTelegramMessage(chatId, '3️⃣ Indica <b>cantidad</b> y unidad.', {
          parse_mode: 'HTML',
        });
      }
      return;
    case 'prioridad':
      await pedirPrioridad(chatId);
      return;
    case 'consumible':
      await pedirConsumible(chatId);
      return;
    case 'monto':
      await pedirMonto(supabase, chatId);
      return;
    case 'confirm':
      await enviarConfirmacion(supabase, chatId, m);
      return;
    default:
      await sendTelegramMessage(chatId, '↩️ Retomando flujo de procura…', { parse_mode: 'HTML' });
  }
}

type PoliticaTtlResult = 'continuar' | 'interceptado';

/**
 * Si la sesión superó 2 h con datos parciales, pide Continuar / Iniciar nueva.
 * Usa `updated_at` de ci_telegram_estados (sin migración adicional).
 */
export async function aplicarPoliticaTtlProcuraDepartamento(
  supabase: SupabaseClient,
  chatId: string,
): Promise<PoliticaTtlResult> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoProcuraDepartamentoTelegram(estado)) return 'continuar';

  const m = meta(estado);

  if (m.ttl_pendiente) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Elige <b>Continuar solicitud</b> o <b>Iniciar nueva</b> con los botones de arriba.',
      { parse_mode: 'HTML' },
    );
    return 'interceptado';
  }

  if (!estadoProcuraDepartamentoExpirado(estado)) return 'continuar';

  if (!tieneProgresoParcialProcura(m)) {
    try {
      await patchMeta(supabase, chatId, estado, { ttl_pendiente: false });
    } catch (e) {
      console.warn('[ttl] renovar sesión vacía:', e);
    }
    return 'continuar';
  }

  const { marked, estado: estadoMarcado, error: errRpc } = await marcarTtlPendienteAtomico(
    supabase,
    chatId,
  );

  if (errRpc) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No pudimos guardar el estado de la sesión. Intenta de nuevo en unos segundos.',
      { parse_mode: 'HTML' },
    );
    return 'interceptado';
  }

  if (!marked) {
    return 'interceptado';
  }

  const mPost = estadoMarcado ? meta(estadoMarcado) : m;
  await enviarPromptTtlProcuraDepartamento(
    chatId,
    resumenSolicitudProcuraDepartamento(mPost),
  );
  return 'interceptado';
}

async function manejarCallbackTtlProcuraDepartamento(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; userId: string },
): Promise<boolean> {
  if (params.data !== CB_STATE_RESUME && params.data !== CB_STATE_RESET) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoProcuraDepartamentoTelegram(estado)) {
    await answerCallbackQuery(params.callbackId, 'Sesión no activa', true);
    return true;
  }

  const auth = await exigirUsuarioSistemaTelegram(supabase, params.userId);
  if (!auth.ok) {
    await answerCallbackQuery(params.callbackId, 'No registrado', true);
    return true;
  }

  if (params.data === CB_STATE_RESUME) {
    await answerCallbackQuery(params.callbackId, 'Retomando…');
    const renovado = await patchMeta(supabase, params.chatId, estado, { ttl_pendiente: false });
    await renderizarPasoProcuraDepartamento(supabase, params.chatId, renovado);
    return true;
  }

  await answerCallbackQuery(params.callbackId, 'Nueva solicitud');
  await setTelegramContexto(supabase, params.chatId, { contexto: 'menu', metadata: {} });
  await manejarComandoProcuraDepartamentoTelegram(supabase, params.chatId, params.userId);
  return true;
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

  const estadoPre = await getTelegramEstado(supabase, chatId);
  if (esFlujoProcuraDepartamentoTelegram(estadoPre)) {
    const ttl = await aplicarPoliticaTtlProcuraDepartamento(supabase, chatId);
    if (ttl === 'interceptado') return true;
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
    `📂 Capítulo: <b>${escHtml(etiquetaCapituloMaestro(cap))}</b>\n\n` +
      `2️⃣ Escribe al menos <b>${MIN_CHARS_BUSQUEDA_MATERIAL} letras</b> del material.\n` +
      'Buscaremos en el catálogo SAP y te mostraremos las mejores coincidencias.',
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

async function pedirMonto(supabase: SupabaseClient, chatId: string): Promise<void> {
  const limite = await limiteViaRapidaUsd(supabase);
  await sendTelegramMessage(
    chatId,
    `6️⃣ <b>Monto estimado en USD</b> (opcional, vía rápida si &lt; USD ${limite}).\n` +
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
  supabase: SupabaseClient,
  chatId: string,
  m: MetadataProcuraDepartamento,
): Promise<void> {
  const limite = await limiteViaRapidaUsd(supabase);
  let viaHint = '<i>Vía larga — pendiente de Aprobador</i>';
  if (m.monto_estimado_usd != null && m.monto_estimado_usd < limite) {
    viaHint = '<i>Monto declarado bajo techo — puede calificar vía rápida</i>';
  } else if (m.monto_estimado_usd == null) {
    viaHint =
      '<i>Sin monto USD — al confirmar se validará consumible estricto + precio histórico</i>';
  }

  await sendTelegramMessage(
    chatId,
    `📋 <b>Confirma la procura</b>\n\n` +
      `👤 ${escHtml(m.usuario_nombre ?? '—')}\n` +
      `📂 ${escHtml(etiquetaCapituloMaestro({ codigo: m.capitulo_codigo ?? '', nombre: m.capitulo_nombre ?? '' }))}\n` +
      `📦 ${escHtml(m.material_txt ?? '')}` +
      (m.por_verificar ? ' <i>(por verificar)</i>\n' : '\n') +
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

  const ttl = await aplicarPoliticaTtlProcuraDepartamento(supabase, chatId);
  if (ttl === 'interceptado') return true;

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
    if (t.length < MIN_CHARS_BUSQUEDA_MATERIAL) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Escribe al menos <b>${MIN_CHARS_BUSQUEDA_MATERIAL} letras</b> para buscar en el catálogo.`,
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await mostrarCoincidenciasMaterial(supabase, chatId, estado, t);
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
    await enviarConfirmacion(supabase, chatId, meta(next));
    return true;
  }

  return false;
}

export async function manejarCallbackProcuraDepartamentoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; userId: string },
): Promise<boolean> {
  if (!esCallbackProcuraDepartamentoTelegram(params.data)) return false;

  if (await manejarCallbackTtlProcuraDepartamento(supabase, params)) {
    return true;
  }

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

  const mEstado = meta(estado);
  const sesionPausadaPorTtl =
    mEstado.ttl_pendiente ||
    (estadoProcuraDepartamentoExpirado(estado) && tieneProgresoParcialProcura(mEstado));
  if (sesionPausadaPorTtl) {
    await answerCallbackQuery(params.callbackId, 'Sesión pausada por inactividad', true);
    if (!mEstado.ttl_pendiente) {
      await aplicarPoliticaTtlProcuraDepartamento(supabase, params.chatId);
    }
    return true;
  }

  if (params.data === CB_NO || params.data === `${CB_CAP}cancel`) {
    await answerCallbackQuery(params.callbackId, 'Cancelado');
    await setTelegramContexto(supabase, params.chatId, { contexto: 'menu', metadata: {} });
    await sendTelegramMessage(params.chatId, '↩️ Procura cancelada.', { parse_mode: 'HTML' });
    return true;
  }

  if (params.data.startsWith(CB_MAT_ID)) {
    const matId = params.data.slice(CB_MAT_ID.length).trim();
    if (!matId || !esUuidProcura(matId)) {
      await answerCallbackQuery(params.callbackId, 'Material inválido', true);
      return true;
    }

    const proyectoId =
      estado.proyecto_id?.trim() || auth.usuario.proyecto_id?.trim() || null;
    const material = await resolverMaterialProcuraPorId(supabase, matId, proyectoId);
    if (!material) {
      await answerCallbackQuery(params.callbackId, 'Material no encontrado', true);
      return true;
    }

    const etiqueta = etiquetaMaterialCatalogo({
      id: material.id,
      name: material.name,
      sap_code: material.sap_code,
      unit: material.unit,
    });
    const unidadCat = normalizarUnidadProcura(material.unit);

    await answerCallbackQuery(params.callbackId, truncarBoton(material.name, 40));
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'cantidad',
      material_id: material.id,
      material_txt: etiqueta.slice(0, 500),
      por_verificar: false,
      unidad: unidadCat,
    });
    await pedirCantidadMaterial(params.chatId, etiqueta, unidadCat);
    return true;
  }

  if (params.data === CB_MAT_TXT) {
    const borrador = meta(estado).material_busqueda_borrador?.trim() ?? '';
    if (borrador.length < MIN_CHARS_BUSQUEDA_MATERIAL) {
      await answerCallbackQuery(params.callbackId, 'Escribe el material primero', true);
      return true;
    }

    const materialTxt = `${PREFIJO_POR_VERIFICAR} ${borrador}`.slice(0, 500);
    await answerCallbackQuery(params.callbackId, 'Texto libre');
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'cantidad',
      material_id: '',
      material_txt: materialTxt,
      por_verificar: true,
    });
    await pedirCantidadMaterial(params.chatId, materialTxt);
    return true;
  }

  if (params.data.startsWith(CB_CAP)) {
    const capId = params.data.slice(CB_CAP.length);
    const cap = await obtenerCapituloMaestroPorId(supabase, capId);
    if (!cap) {
      await answerCallbackQuery(params.callbackId, 'Capítulo no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, etiquetaCapituloMaestro(cap));
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
    await pedirMonto(supabase, params.chatId);
    return true;
  }

  if (params.data === CB_MONTO_SKIP) {
    await answerCallbackQuery(params.callbackId, 'Sin monto');
    const next = await patchMeta(supabase, params.chatId, estado, {
      paso: 'confirm',
      monto_estimado_usd: null,
    });
    await enviarConfirmacion(supabase, params.chatId, meta(next));
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
      materialId: m.material_id?.trim() || null,
      porVerificar: Boolean(m.por_verificar),
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

    const msgVia = data.errorConsultaHistorico
      ? '⚠️ No se pudo verificar el costo histórico por problemas de conexión. Por seguridad financiera, la solicitud se envió a revisión de la oficina (<b>Vía Larga</b>).'
      : data.viaRapida
        ? `⚡ <b>Vía rápida</b> — ${escHtml(etiquetaEstadoProcura('aprobada_directa'))}\n${escHtml(data.motivoVia)}`
        : `⏳ <b>Vía larga</b> — pendiente de aprobación en oficina / canal admin.`;

    await sendTelegramMessage(
      params.chatId,
      `✅ <b>Procura registrada</b>\n\n` +
        `🎫 ${escHtml(data.ticket)}\n` +
        `📂 ${escHtml(etiquetaCapituloMaestro({ codigo: m.capitulo_codigo ?? '', nombre: m.capitulo_nombre ?? '' }))}\n` +
        `📦 ${escHtml(m.material_txt)}\n\n` +
        msgVia,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}
