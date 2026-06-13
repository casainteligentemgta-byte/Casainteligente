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
  CB_CAPITULO_MAESTRO_NUEVO,
  etiquetaCapituloMaestro,
  listarCapitulosMaestro,
  obtenerCapituloMaestroPorId,
  tecladoCapitulosMaestro,
} from '@/lib/compras/capitulosMaestro';
import { crearCapituloMaestroProcura } from '@/lib/compras/capitulosProcuraApu';
import { registrarProcuraDepartamento } from '@/lib/compras/registrarProcuraDepartamento';
import {
  nombreMaterialProcuraVisible,
  sanitizarNumeroVenezolano,
} from '@/lib/compras/procuraMaterialTexto';
import {
  exigirUsuarioSistemaTelegram,
  usuarioPuedeSolicitarProcura,
} from '@/lib/compras/usuariosSistemaTelegram';
import {
  inferirConsumibleYMontoProcura,
  limiteViaRapidaUsd,
  parsePrioridadProcura,
  type PrioridadProcura,
} from '@/lib/compras/viaRapidaProcura';
import {
  buscarMaterialesInteligenteCatalogo,
  etiquetaMaterialCatalogo,
} from '@/lib/almacen/buscarMaterialesCatalogo';
import { aprenderAliasMaterial } from '@/lib/almacen/materialAliases';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import { resolverEntidadIdCatalogo } from '@/lib/almacen/catalogoEntidad';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import { marcarTtlPendienteAtomico } from '@/lib/compras/telegramTtlAtomico';
import {
  CB_UNIDAD_PROCURA_ESCRIBIR,
  CODIGOS_UNIDADES_PROCURA_TELEGRAM,
  etiquetaUnidadProcuraTelegram,
  normalizarUnidadProcura,
  tecladoUnidadesProcuraPrincipales,
} from '@/lib/procuras/unidadesProcura';
import {
  confirmarAbastecimientoProcura,
  esCallbackAbastecimientoProcura,
  etiquetaResultadoAbastecimiento,
  parseCallbackAbastecimientoProcura,
} from '@/lib/procuras/abastecimientoProcuraAprobada';
import {
  construirMensajeSolicitanteProcuraViaLarga,
  construirMensajeSolicitanteProcuraViaLargaHistorico,
  construirMensajeSolicitanteProcuraViaRapida,
} from '@/lib/procuras/mensajeAlertaProcuraTelegram';
import {
  consultarDisponibilidadMaterialProcura,
  lineaDisponibilidadMaterialProcura,
} from '@/lib/procuras/disponibilidadMaterialProcura';
import { resolverMaterialProcuraPorId } from '@/lib/telegram/procuraMaterialPicker';
import {
  callbackDataTelegramValido,
  esUuidProcura,
  parseMetadataProcuraDepartamento,
  type MetadataProcuraDepartamentoParsed,
  type PasoProcuraDepartamento,
} from '@/lib/compras/telegramMetadata';

const PREFIX = 'cmp:';
const CB_CAP = `${PREFIX}cap:`;
const CB_MAT_ID = `${PREFIX}mat_id:`;
const CB_MAT_TXT = `${PREFIX}mat:txt`;
const CB_PRI = `${PREFIX}pri:`;
const CB_UNI = `${PREFIX}uni:`;
const CB_OK = `${PREFIX}ok`;
const CB_NO = `${PREFIX}no`;
const CB_STATE_RESUME = `${PREFIX}state:resume`;
const CB_STATE_RESET = `${PREFIX}state:reset`;
const MIN_CHARS_BUSQUEDA_MATERIAL = 3;

/** Umbral para mostrar «¿Quisiste decir…?» cuando el término no coincide exactamente. */
const SCORE_SUGERENCIA_MATERIAL = 80;

/** TTL de sesión procura departamento (caídas de señal Margarita / interior). */
export const TTL_PROCURA_DEPARTAMENTO_MS = 2 * 60 * 60 * 1000;

export type { PasoProcuraDepartamento };

function cantidadDesdeTextoOperario(texto: string): number | null {
  const n = sanitizarNumeroVenezolano(texto.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export type MetadataProcuraDepartamento = MetadataProcuraDepartamentoParsed;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncarBoton(s: string, max = 56): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function pedirCantidadMaterial(chatId: string, materialTxt: string): Promise<void> {
  const nombre = nombreMaterialProcuraVisible(materialTxt);
  await sendTelegramMessage(
    chatId,
    `📦 Material: <b>${escHtml(nombre)}</b>\n\n` +
      `3️⃣ Indica la <b>cantidad</b> del material (número, ej. <code>50</code> o <code>2.5</code>):`,
    { parse_mode: 'HTML' },
  );
}

async function pedirUnidadMaterial(chatId: string, cantidad: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `🔢 Cantidad: <b>${cantidad.toLocaleString('es-VE')}</b>\n\n` +
      `4️⃣ Elige la <b>unidad</b> del material:`,
    {
      parse_mode: 'HTML',
      reply_markup: tecladoUnidadesProcuraPrincipales(CB_UNI),
    },
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

  const proyectoId = estado.proyecto_id?.trim() || null;
  const entidadId = await resolverEntidadIdCatalogo(supabase, { proyectoId });

  let resultados: Awaited<ReturnType<typeof buscarMaterialesInteligenteCatalogo>>;
  try {
    resultados = await buscarMaterialesInteligenteCatalogo(supabase, t, {
      limit: 5,
      entidadId,
      proyectoId,
    });
  } catch (e) {
    await sendTelegramMessage(
      chatId,
      `❌ Error al buscar materiales: ${escHtml(e instanceof Error ? e.message : 'Error')}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const materiales = resultados.map((r) => r.material);
  const top = resultados[0];
  const termNorm = normalizarTextoMaterial(t);

  let sugerencia = '';
  if (top && top.score >= SCORE_SUGERENCIA_MATERIAL) {
    const topNorm = normalizarTextoMaterial(top.material.name);
    const coincideExacto =
      topNorm === termNorm ||
      topNorm.split(/\s+/).some((w) => w === termNorm) ||
      top.material.name.toLowerCase().includes(t.toLowerCase());
    if (!coincideExacto) {
      sugerencia = `\n\n💡 ¿Quisiste decir <b>${escHtml(top.material.name)}</b>?`;
    }
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
      text: 'Ingresa Material',
      callback_data: CB_MAT_TXT,
    },
  ]);

  const sinResultados =
    materiales.length === 0
      ? '\n\n<i>No hay coincidencias en catálogo. Usa «Ingresa Material» para confirmar tu descripción.</i>'
      : '';

  await sendTelegramMessage(
    chatId,
    `Elige un material del catálogo o confirma tu descripción:${sugerencia}${sinResultados}`,
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
    case 'nuevo_capitulo':
      await sendTelegramMessage(
        chatId,
        '✏️ Escribe el <b>título del capítulo</b>.\n\n' +
          'Opcional: incluye número al inicio, ej.\n' +
          '<code>09 Techos y cubiertas</code>',
        { parse_mode: 'HTML' },
      );
      return;
    case 'material':
      if (m.capitulo_codigo && m.capitulo_nombre) {
        await pedirMaterial(chatId, {
          codigo: m.capitulo_codigo,
          nombre: m.capitulo_nombre,
        });
      } else {
        await sendTelegramMessage(
          chatId,
          '2️⃣ Escribe el <b>material</b> a solicitar.',
          { parse_mode: 'HTML' },
        );
      }
      return;
    case 'cantidad':
      if (m.material_txt?.trim()) {
        await pedirCantidadMaterial(chatId, m.material_txt);
      } else {
        await sendTelegramMessage(chatId, '3️⃣ Indica solo la <b>cantidad</b> (número).', {
          parse_mode: 'HTML',
        });
      }
      return;
    case 'unidad':
      if (m.cantidad != null && Number.isFinite(m.cantidad)) {
        await pedirUnidadMaterial(chatId, m.cantidad);
      } else {
        await sendTelegramMessage(chatId, '4️⃣ Elige la <b>unidad</b> en los botones.', {
          parse_mode: 'HTML',
          reply_markup: tecladoUnidadesProcuraPrincipales(CB_UNI),
        });
      }
      return;
    case 'unidad_texto':
      await sendTelegramMessage(
        chatId,
        '✏️ Escribe la <b>unidad</b> (ej. <code>GAL</code>, <code>KG</code>, <code>ROLLO</code>):',
        { parse_mode: 'HTML' },
      );
      return;
    case 'prioridad':
      await pedirPrioridad(chatId);
      return;
    case 'consumible':
    case 'monto':
      await avanzarAConfirmacionAutocompletada(supabase, chatId, estado);
      return;
    case 'confirm':
      await enviarConfirmacion(supabase, chatId, estado, m);
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
      `2️⃣ Escribe el <b>material</b> a solicitar.\n` +
      `<i>(Mínimo ${MIN_CHARS_BUSQUEDA_MATERIAL} letras para buscar en catálogo.)</i>`,
    { parse_mode: 'HTML' },
  );
}

async function avanzarAConfirmacionAutocompletada(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  if (!m.material_txt?.trim() || m.cantidad == null || !m.unidad || !m.prioridad) {
    await sendTelegramMessage(chatId, '❌ Datos incompletos. Use /procura de nuevo.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const auto = await inferirConsumibleYMontoProcura(supabase, {
    descripcionMaterial: m.material_txt,
    cantidad: m.cantidad,
    materialId: m.material_id?.trim() || null,
  });

  const next = await patchMeta(supabase, chatId, estado, {
    paso: 'confirm',
    es_consumible: auto.esConsumible,
    monto_estimado_usd: auto.montoEstimadoUsd,
    observaciones: auto.notaAuto,
  });
  await enviarConfirmacion(supabase, chatId, estado, meta(next));
}

async function pedirPrioridad(chatId: string): Promise<void> {
  await sendTelegramMessage(chatId, '5️⃣ Elige la <b>prioridad</b> de la procura:', {
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

async function resolverNombreMaterialConfirmacion(
  supabase: SupabaseClient,
  m: MetadataProcuraDepartamento,
  proyectoId: string | null,
): Promise<string> {
  const matId = m.material_id?.trim();
  if (matId && esUuidProcura(matId)) {
    try {
      const material = await resolverMaterialProcuraPorId(supabase, matId, proyectoId);
      if (material?.name?.trim()) return material.name.trim();
    } catch {
      /* fallback texto sesión */
    }
  }
  return nombreMaterialProcuraVisible(m.material_txt ?? '');
}

async function enviarConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  m: MetadataProcuraDepartamento,
): Promise<void> {
  const limite = await limiteViaRapidaUsd(supabase);
  let viaHint = '<i>Vía larga — pendiente del Administrador y Project Manager</i>';
  if (m.monto_estimado_usd != null && m.monto_estimado_usd < limite) {
    viaHint = '<i>Monto declarado bajo techo — puede calificar vía rápida</i>';
  } else if (m.monto_estimado_usd == null) {
    viaHint =
      '<i>Sin monto USD — al confirmar se validará consumible estricto + precio histórico</i>';
  }

  const proyectoId = estado.proyecto_id?.trim() || null;
  const entidadId = await resolverEntidadIdCatalogo(supabase, { proyectoId });
  const nombreMaterial = await resolverNombreMaterialConfirmacion(supabase, m, proyectoId);
  const unidadLabel = etiquetaUnidadProcuraTelegram(m.unidad ?? 'UND');

  const disponibilidad = await consultarDisponibilidadMaterialProcura(supabase, {
    materialId: m.material_id?.trim() || null,
    proyectoId,
    entidadId,
    unidadFallback: m.unidad ?? 'UND',
  });
  const lineaStock = lineaDisponibilidadMaterialProcura(disponibilidad, escHtml);

  await sendTelegramMessage(
    chatId,
    `6️⃣ <b>CONFIRMACIÓN DE LA PROCURA</b>\n\n` +
      `👤 ${escHtml(m.usuario_nombre ?? '—')}\n` +
      `📂 ${escHtml(etiquetaCapituloMaestro({ codigo: m.capitulo_codigo ?? '', nombre: m.capitulo_nombre ?? '' }))}\n` +
      `📦 <b>${escHtml(nombreMaterial)}</b>\n` +
      `🔢 ${m.cantidad ?? '—'} ${escHtml(unidadLabel)}\n` +
      `${lineaStock}\n` +
      `⚡ Prioridad: <b>${escHtml(m.prioridad ?? 'Media')}</b>\n` +
      (m.es_consumible ? '🧴 Consumible: sí (auto)\n' : '🧴 Consumible: no (auto)\n') +
      (m.monto_estimado_usd != null
        ? `💵 USD ~${m.monto_estimado_usd.toFixed(2)} (auto)\n`
        : '💵 USD: sin histórico (auto)\n') +
      `\n${viaHint}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ CONFIRMAR', callback_data: CB_OK },
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

  if (paso === 'nuevo_capitulo') {
    try {
      const cap = await crearCapituloMaestroProcura(supabase, t);
      await patchMeta(supabase, chatId, estado, {
        paso: 'material',
        capitulo_id: cap.id,
        capitulo_codigo: cap.codigo,
        capitulo_nombre: cap.nombre,
      });
      await sendTelegramMessage(
        chatId,
        `✅ Capítulo creado: <b>${escHtml(etiquetaCapituloMaestro(cap))}</b>`,
        { parse_mode: 'HTML' },
      );
      await pedirMaterial(chatId, cap);
    } catch (e) {
      await sendTelegramMessage(
        chatId,
        `❌ ${escHtml(e instanceof Error ? e.message : 'No se pudo crear el capítulo')}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  if (paso === 'unidad_texto') {
    if (t.length < 1) {
      await sendTelegramMessage(chatId, '⚠️ Escribe la unidad (ej. <code>KG</code>).', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const unidad = normalizarUnidadProcura(t);
    await patchMeta(supabase, chatId, estado, {
      paso: 'prioridad',
      unidad,
    });
    await sendTelegramMessage(
      chatId,
      `📏 Unidad: <b>${escHtml(etiquetaUnidadProcuraTelegram(unidad))}</b>`,
      { parse_mode: 'HTML' },
    );
    await pedirPrioridad(chatId);
    return true;
  }

  if (paso === 'material') {
    if (t.length < MIN_CHARS_BUSQUEDA_MATERIAL) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Escribe al menos <b>${MIN_CHARS_BUSQUEDA_MATERIAL} letras</b> del material a solicitar.`,
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await mostrarCoincidenciasMaterial(supabase, chatId, estado, t);
    return true;
  }

  if (paso === 'cantidad') {
    const cantidad = cantidadDesdeTextoOperario(t);
    if (cantidad == null) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Cantidad inválida. Escribe un número (ej. <code>10</code>, <code>2,5</code> o <code>1.250</code>).',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await patchMeta(supabase, chatId, estado, {
      paso: 'unidad',
      cantidad,
    });
    await pedirUnidadMaterial(chatId, cantidad);
    return true;
  }

  if (paso === 'monto') {
    const monto = sanitizarNumeroVenezolano(t);
    if (!Number.isFinite(monto) || monto <= 0) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Monto inválido. Escribe un número (ej. <code>25</code>, <code>12,50</code> o <code>1.200</code>).',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    const next = await patchMeta(supabase, chatId, estado, {
      paso: 'confirm',
      monto_estimado_usd: monto,
    });
    await enviarConfirmacion(supabase, chatId, estado, meta(next));
    return true;
  }

  return false;
}

export async function manejarCallbackProcuraDepartamentoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; userId: string },
): Promise<boolean> {
  if (!esCallbackProcuraDepartamentoTelegram(params.data)) return false;

  if (esCallbackAbastecimientoProcura(params.data)) {
    const procuraId = parseCallbackAbastecimientoProcura(params.data);
    if (!procuraId) {
      await answerCallbackQuery(params.callbackId, 'Procura inválida', true);
      return true;
    }
    const auth = await exigirUsuarioSistemaTelegram(supabase, params.userId);
    const nombre = auth.ok ? auth.usuario.nombre : 'Depositario';
    await answerCallbackQuery(params.callbackId, 'Verificando almacén…');
    const resultado = await confirmarAbastecimientoProcura(supabase, {
      procuraId,
      autorNombre: nombre,
    });
    await sendTelegramMessage(
      params.chatId,
      resultado.ok
        ? `✅ <b>${escHtml(etiquetaResultadoAbastecimiento(resultado))}</b>`
        : `❌ ${escHtml(resultado.error ?? 'No se pudo abastecer')}`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

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
    const entidadId = await resolverEntidadIdCatalogo(supabase, { proyectoId });
    const material = await resolverMaterialProcuraPorId(supabase, matId, proyectoId);
    if (!material) {
      await answerCallbackQuery(params.callbackId, 'Material no encontrado', true);
      return true;
    }

    await answerCallbackQuery(params.callbackId, truncarBoton(material.name, 40));

    const borrador = meta(estado).material_busqueda_borrador?.trim();
    if (borrador && entidadId) {
      void aprenderAliasMaterial(supabase, {
        entidadId,
        alias: borrador,
        materialId: material.id,
        materialName: material.name,
      }).catch(() => {});
    }

    await patchMeta(supabase, params.chatId, estado, {
      paso: 'cantidad',
      material_id: material.id,
      material_txt: material.name.slice(0, 500),
      por_verificar: false,
    });
    await pedirCantidadMaterial(params.chatId, material.name);
    return true;
  }

  if (params.data === CB_MAT_TXT) {
    const borrador = meta(estado).material_busqueda_borrador?.trim() ?? '';
    if (borrador.length < MIN_CHARS_BUSQUEDA_MATERIAL) {
      await answerCallbackQuery(params.callbackId, 'Escribe el material primero', true);
      return true;
    }

    const materialTxt = borrador.slice(0, 500);
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

    if (capId === 'cancel') {
      await answerCallbackQuery(params.callbackId, 'Cancelado');
      await setTelegramContexto(supabase, params.chatId, { contexto: 'menu', metadata: {} });
      await sendTelegramMessage(params.chatId, '↩️ Procura cancelada.', { parse_mode: 'HTML' });
      return true;
    }

    if (capId === CB_CAPITULO_MAESTRO_NUEVO) {
      await answerCallbackQuery(params.callbackId);
      await patchMeta(supabase, params.chatId, estado, { paso: 'nuevo_capitulo' });
      await sendTelegramMessage(
        params.chatId,
        '✏️ Escribe el <b>título del capítulo</b>.\n\n' +
          'Opcional: incluye número al inicio, ej.\n' +
          '<code>09 Techos y cubiertas</code>',
        { parse_mode: 'HTML' },
      );
      return true;
    }

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

  if (params.data.startsWith(CB_UNI)) {
    const suffix = params.data.slice(CB_UNI.length);

    if (suffix === CB_UNIDAD_PROCURA_ESCRIBIR) {
      await answerCallbackQuery(params.callbackId);
      await patchMeta(supabase, params.chatId, estado, { paso: 'unidad_texto' });
      await sendTelegramMessage(
        params.chatId,
        '✏️ Escribe la <b>unidad</b> (ej. <code>GAL</code>, <code>KG</code>, <code>ROLLO</code>):',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const codigo = normalizarUnidadProcura(suffix);
    if (!CODIGOS_UNIDADES_PROCURA_TELEGRAM.includes(codigo)) {
      await answerCallbackQuery(params.callbackId, 'Unidad inválida', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, etiquetaUnidadProcuraTelegram(codigo));
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'prioridad',
      unidad: codigo,
    });
    await pedirPrioridad(params.chatId);
    return true;
  }

  if (params.data.startsWith(CB_PRI)) {
    const pri = parsePrioridadProcura(params.data.slice(CB_PRI.length));
    if (!pri) {
      await answerCallbackQuery(params.callbackId, 'Prioridad inválida', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, pri);
    const next = await patchMeta(supabase, params.chatId, estado, { prioridad: pri });
    await avanzarAConfirmacionAutocompletada(supabase, params.chatId, next);
    return true;
  }

  if (params.data === CB_OK) {
    await answerCallbackQuery(params.callbackId, 'Registrando…');
    const fresh = await getTelegramEstado(supabase, params.chatId);
    const m = meta(fresh);

    if (!m.capitulo_id || !m.material_txt || !m.cantidad || !m.unidad || !m.prioridad) {
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

    if (!data && !error) {
      return true;
    }

    await setTelegramContexto(supabase, params.chatId, { contexto: 'menu', metadata: {} });

    if (error || !data) {
      await sendTelegramMessage(
        params.chatId,
        `❌ ${escHtml(error?.message ?? 'Error al registrar')}`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    let textoConfirmacion: string;
    if (data.errorConsultaHistorico) {
      textoConfirmacion = construirMensajeSolicitanteProcuraViaLargaHistorico(data.ticket);
    } else if (data.viaRapida) {
      textoConfirmacion = construirMensajeSolicitanteProcuraViaRapida({
        ticket: data.ticket,
        capituloLabel: etiquetaCapituloMaestro({
          codigo: m.capitulo_codigo ?? '',
          nombre: m.capitulo_nombre ?? '',
        }),
        materialTxt: m.material_txt ?? '',
        cantidad: Number(m.cantidad),
        unidad: m.unidad ?? 'UND',
        prioridad: m.prioridad ?? 'Media',
        motivoVia: `${etiquetaEstadoProcura('aprobada_directa')} — ${data.motivoVia}`,
      });
    } else {
      textoConfirmacion = construirMensajeSolicitanteProcuraViaLarga(data.ticket);
    }

    await sendTelegramMessage(params.chatId, textoConfirmacion, { parse_mode: 'HTML' });
    return true;
  }

  return false;
}
