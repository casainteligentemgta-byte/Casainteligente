import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ETAPAS_CUELLO,
  calcularCuellosBotella,
  crearResolutorResponsables,
  textoEdad,
  type ClaveEtapa,
  type ItemCuello,
} from '@/lib/compras/cuellosBotella';
import { obtenerUsuarioSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { esUuidProcura } from '@/lib/compras/telegramMetadata';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { simulacionBotActiva } from '@/lib/telegram/simulacion/contexto';

/**
 * Torre de Control por Telegram para administración: /detenidos muestra lo que está
 * detenido en la cadena de compras y deja resolverlo desde el chat — aprobar, revisar
 * fondos, cargar la factura, retirar, despachar, liberar la cuarentena, descartar una
 * factura, cancelar una procura o recordarle al responsable.
 *
 * Donde ya existe un botón del flujo (aprobar, despachar, «La retiro yo»…) se reutiliza
 * tal cual, con sus mismas reglas. Las acciones propias de este módulo empiezan por «tc:».
 */

const PREFIX = 'tc:';
const CB_ETAPA = `${PREFIX}e:`;
const CB_RECORDAR = `${PREFIX}r:`;
const CB_CANCELAR_PROCURA = `${PREFIX}xp:`;
const CB_CANCELAR_PROCURA_OK = `${PREFIX}xk:`;
const CB_DESCARTAR_FACTURA = `${PREFIX}xn:`;
const CB_DESCARTAR_FACTURA_OK = `${PREFIX}nk:`;
const CB_LIBERAR = `${PREFIX}q:`;
const CB_LIBERAR_OK = `${PREFIX}qk:`;
const CB_NO = `${PREFIX}no`;

/** Letra de cada etapa en los botones (Telegram limita el dato a 64 bytes). */
const CODIGO: Record<ClaveEtapa, string> = {
  aprobacion: 'a',
  compra: 'c',
  canal: 'n',
  retiro: 'r',
  transporte: 't',
  cuarentena: 'q',
  ingreso: 'i',
  pedidos: 'p',
  stock: 's',
};
const DE_CODIGO = new Map(Object.entries(CODIGO).map(([k, v]) => [v, k as ClaveEtapa]));

const MAX_ITEMS = 8;

const RE_COMANDO = /^\/(detenidos|torre)(@\S+)?\s*$/i;

type Boton = { text: string; callback_data?: string; url?: string };

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function urlBase(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://casainteligente.company')
    .trim()
    .replace(/\/$/, '');
}

export function esComandoDetenidos(texto: string): boolean {
  return RE_COMANDO.test(texto.trim());
}

export function esCallbackTorreControl(data: string): boolean {
  return data.startsWith(PREFIX);
}

/** Solo administración usa la Torre por Telegram. En un ensayo, solo ve la obra de ensayo. */
async function administrador(
  supabase: SupabaseClient,
  chatId: string,
): Promise<{ nombre: string; soloObra: string | null } | null> {
  const u = await obtenerUsuarioSistemaTelegram(supabase, chatId).catch(() => null);
  if (!u || u.rol !== 'Administrador') return null;
  return { nombre: u.nombre?.trim() || 'Administración', soloObra: simulacionBotActiva() ? u.proyecto_id ?? null : null };
}

async function negar(chatId: string, callbackId?: string): Promise<void> {
  const texto = '⛔ La Torre de Control por Telegram es solo para administración.';
  if (callbackId) await answerCallbackQuery(callbackId, texto, true);
  else await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
}

function lineaItem(it: ItemCuello): string {
  const obra = it.obra ? ` · ${escHtml(it.obra)}` : '';
  return (
    `${it.critico ? '🔴' : '🟠'} <b>${escHtml(it.referencia)}</b>` +
    (it.detalle ? `\n${escHtml(it.detalle.slice(0, 160))}` : '') +
    `${obra}\n⏱ ${textoEdad(it.horas)}`
  );
}

/** /detenidos: resumen por etapa con un botón para abrir cada una. */
export async function manejarComandoDetenidos(supabase: SupabaseClient, chatId: string): Promise<void> {
  const adm = await administrador(supabase, chatId);
  if (!adm) return negar(chatId);

  const resumen = await calcularCuellosBotella(supabase, { proyectoId: adm.soloObra });
  const conDetenidos = resumen.etapas.filter((e) => e.detenidos > 0);
  if (!conDetenidos.length) {
    await sendTelegramMessage(chatId, '✅ <b>No hay pendientes detenidos.</b> Todo va dentro de su plazo.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const lineas = [
    `🗼 <b>Torre de Control</b> — ${resumen.totalDetenidos} detenido${resumen.totalDetenidos === 1 ? '' : 's'}` +
      (resumen.totalCriticos ? ` (🔴 ${resumen.totalCriticos} crítico${resumen.totalCriticos === 1 ? '' : 's'})` : ''),
    '',
    ...conDetenidos.map(
      (e) => `${e.criticos ? '🔴' : '🟠'} ${escHtml(e.titulo)}: <b>${e.detenidos}</b> · ${escHtml(e.responsable)}`,
    ),
    '',
    'Elija una etapa para verlos y resolverlos:',
  ];
  const filas: Boton[][] = conDetenidos.map((e) => [
    { text: `${e.criticos ? '🔴' : '🟠'} ${e.titulo} (${e.detenidos})`, callback_data: `${CB_ETAPA}${CODIGO[e.clave]}` },
  ]);
  filas.push([{ text: '🌐 Abrir la Torre de Control', url: `${urlBase()}/compras/torre-control` }]);
  await sendTelegramMessage(chatId, lineas.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: filas } });
}

/** Botones para resolver un ítem detenido, según su etapa. */
async function botonesItem(supabase: SupabaseClient, etapa: ClaveEtapa, it: ItemCuello): Promise<Boton[][]> {
  const recordar: Boton = { text: '🔔 Recordar al responsable', callback_data: `${CB_RECORDAR}${CODIGO[etapa]}:${it.id}` };
  const id = it.id;
  switch (etapa) {
    case 'aprobacion': {
      const { data } = await supabase
        .from('ci_procuras')
        .select('estado,viabilidad_presupuestaria')
        .eq('id', id)
        .maybeSingle();
      const p = (data ?? {}) as { estado?: string; viabilidad_presupuestaria?: string | null };
      if (p.estado === 'pendiente_pm') {
        const { tecladoAprobacionDepartamento } = await import('@/lib/compras/aprobacionDepartamentoTelegram');
        const { procuraSinFondos } = await import('@/lib/procuras/compraACredito');
        return [...(tecladoAprobacionDepartamento(id, { aCredito: procuraSinFondos(p) }).inline_keyboard as Boton[][]), [recordar]];
      }
      const { tecladoViabilidadAdmin } = await import('@/lib/procuras/viabilidadAdminProcuraTelegram');
      return [...(tecladoViabilidadAdmin(id).inline_keyboard as Boton[][]), [recordar]];
    }
    case 'compra': {
      const { tecladoFacturaOrdenCompraProcura } = await import('@/lib/telegram/facturaOrdenCompraTelegram');
      return [
        ...(tecladoFacturaOrdenCompraProcura(id).inline_keyboard as Boton[][]),
        [recordar, { text: '❌ Cancelar procura', callback_data: `${CB_CANCELAR_PROCURA}${id}` }],
      ];
    }
    case 'canal':
      return [
        [{ text: '🌐 Revisar y confirmar', url: `${urlBase()}/contabilidad/compras/canal?pendiente=${id}` }],
        [recordar, { text: '🗑 Descartar factura', callback_data: `${CB_DESCARTAR_FACTURA}${id}` }],
      ];
    case 'retiro':
      return [[{ text: '🚚 La retiro yo', callback_data: `rt:tk:${id}` }, recordar]];
    case 'cuarentena':
      return [[{ text: '✅ Liberar todo al almacén', callback_data: `${CB_LIBERAR}${id}` }, recordar]];
    case 'pedidos':
      return [
        [
          { text: '✅ Despachar', callback_data: `rq:dk:${id}` },
          { text: '❌ Rechazar', callback_data: `rq:rj:${id}` },
        ],
        [recordar],
      ];
    case 'stock':
      // El id es material|obra (no cabe en un botón): se pide con /procura.
      return [];
    default:
      return [[recordar]];
  }
}

async function enviarEtapa(supabase: SupabaseClient, chatId: string, etapa: ClaveEtapa, soloObra: string | null): Promise<void> {
  const resumen = await calcularCuellosBotella(supabase, { proyectoId: soloObra });
  const e = resumen.etapas.find((x) => x.clave === etapa);
  const detenidos = (e?.items ?? []).filter((i) => i.detenido);
  if (!e || !detenidos.length) {
    await sendTelegramMessage(chatId, '✅ Ya no hay detenidos en esa etapa.', { parse_mode: 'HTML' });
    return;
  }
  await sendTelegramMessage(
    chatId,
    `🗼 <b>${escHtml(e.titulo)}</b> — ${detenidos.length} detenido${detenidos.length === 1 ? '' : 's'}\n` +
      `<i>Le toca a: ${escHtml(e.responsable)}. Puede resolverlo usted con los botones.</i>` +
      (etapa === 'stock' ? '\n<i>Para reponer un material, pídalo con /procura.</i>' : ''),
    { parse_mode: 'HTML' },
  );
  for (const it of detenidos.slice(0, MAX_ITEMS)) {
    const filas = await botonesItem(supabase, etapa, it);
    await sendTelegramMessage(chatId, lineaItem(it), {
      parse_mode: 'HTML',
      ...(filas.length ? { reply_markup: { inline_keyboard: filas } } : {}),
    });
  }
  if (detenidos.length > MAX_ITEMS) {
    await sendTelegramMessage(
      chatId,
      `… y ${detenidos.length - MAX_ITEMS} más. <a href="${urlBase()}/compras/torre-control">Verlos todos en la Torre de Control</a>`,
      { parse_mode: 'HTML' },
    );
  }
}

/** Le reenvía el pendiente a quien le toca moverlo (sin incluir a quien lo pide). */
async function recordar(
  supabase: SupabaseClient,
  chatId: string,
  callbackId: string,
  etapa: ClaveEtapa,
  id: string,
  adm: { nombre: string; soloObra: string | null },
): Promise<void> {
  const resumen = await calcularCuellosBotella(supabase, { proyectoId: adm.soloObra });
  const def = ETAPAS_CUELLO.find((x) => x.clave === etapa)!;
  const it = resumen.etapas.find((x) => x.clave === etapa)?.items.find((i) => i.id === id);
  if (!it) {
    await answerCallbackQuery(callbackId, 'Ya no está detenido: alguien lo resolvió.', true);
    return;
  }
  const resolver = await crearResolutorResponsables(supabase);
  // Sin el escalamiento a administración: quien recuerda ya es administración.
  const destinos = (await resolver(def, { ...it, critico: false })).filter((d) => d.chatId !== chatId);
  if (!destinos.length) {
    await answerCallbackQuery(callbackId, 'No hay a quién recordárselo en esa obra: resuélvalo con los botones.', true);
    return;
  }
  const texto =
    `🔔 <b>Recordatorio de ${escHtml(adm.nombre)}</b>\n` +
    `<b>${escHtml(def.titulo)}</b> desde hace ${textoEdad(it.horas)}\n\n` +
    `${escHtml(it.referencia)}${it.detalle ? ` · ${escHtml(it.detalle.slice(0, 160))}` : ''}` +
    (it.obra ? `\n🏗 ${escHtml(it.obra)}` : '') +
    '\n\nPor favor, resuélvalo hoy.';
  let enviados = 0;
  for (const d of destinos) {
    try {
      await sendTelegramMessage(d.chatId, texto, { parse_mode: 'HTML', contextoLogEspejo: '[Torre de Control · recordatorio]' });
      enviados += 1;
    } catch (e) {
      console.warn('[torreControlTelegram] recordatorio', d.chatId, e);
    }
  }
  await answerCallbackQuery(callbackId, `Recordado a ${enviados}`);
  await sendTelegramMessage(
    chatId,
    `🔔 Recordatorio enviado a ${destinos.map((d) => escHtml(d.nombre ?? 'responsable')).join(', ')}.`,
    { parse_mode: 'HTML' },
  );
}

function confirmar(pregunta: string, siData: string) {
  return {
    texto: `⚠️ ${pregunta}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Sí, hacerlo', callback_data: siData },
          { text: 'No', callback_data: CB_NO },
        ],
      ],
    },
  };
}

async function cancelarProcura(supabase: SupabaseClient, chatId: string, callbackId: string, id: string, nombre: string): Promise<void> {
  const { data } = await supabase.from('ci_procuras').select('id,ticket,estado,solicitante_telegram_chat_id').eq('id', id).maybeSingle();
  const p = data as { ticket?: string; estado?: string; solicitante_telegram_chat_id?: number | null } | null;
  if (!p || !['solicitada', 'pendiente_pm', 'aprobada', 'aprobada_directa'].includes(String(p.estado))) {
    await answerCallbackQuery(callbackId, 'Esa procura ya no está pendiente.', true);
    return;
  }
  const { ejecutarTransicionProcuraLote } = await import('@/lib/procuras/auditoriaSupervisorProcura');
  await ejecutarTransicionProcuraLote(supabase, {
    procuraId: id,
    nuevoEstado: 'cancelada',
    motivo: `Cancelada por administración (${nombre}): detenida en la Torre de Control`,
    usuario: nombre,
  });
  try {
    const { actualizarTicketProcuraSolicitante } = await import('@/lib/procuras/ticketProcuraSolicitanteTelegram');
    await actualizarTicketProcuraSolicitante(supabase, id);
  } catch (e) {
    console.warn('[torreControlTelegram] ticket', e);
  }
  if (p.solicitante_telegram_chat_id != null) {
    await sendTelegramMessage(
      String(p.solicitante_telegram_chat_id),
      `❌ <b>Procura ${escHtml(String(p.ticket ?? ''))} cancelada</b> por administración (${escHtml(nombre)}).\n` +
        'Si todavía necesita el material, pídalo de nuevo con /procura.',
      { parse_mode: 'HTML' },
    ).catch(() => undefined);
  }
  await answerCallbackQuery(callbackId, 'Procura cancelada');
  await sendTelegramMessage(chatId, `❌ Procura <b>${escHtml(String(p.ticket ?? ''))}</b> cancelada. Se avisó a quien la pidió.`, {
    parse_mode: 'HTML',
  });
}

async function descartarFactura(supabase: SupabaseClient, chatId: string, callbackId: string, id: string, nombre: string): Promise<void> {
  const { data } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({ estado: 'rechazado', mensaje_error: `Descartada por administración (${nombre})`, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('estado', ['recibido', 'procesando', 'extraido'])
    .select('chat_id,extracted');
  const fila = ((data ?? []) as Array<{ chat_id?: string | number | null; extracted?: { invoice_number?: string } | null }>)[0];
  if (!fila) {
    await answerCallbackQuery(callbackId, 'Esa factura ya no está pendiente.', true);
    return;
  }
  const numero = fila.extracted?.invoice_number ? ` #${escHtml(String(fila.extracted.invoice_number))}` : '';
  if (fila.chat_id != null && String(fila.chat_id) !== chatId) {
    await sendTelegramMessage(String(fila.chat_id), `🗑 Su factura${numero} fue descartada por administración (${escHtml(nombre)}).`, {
      parse_mode: 'HTML',
    }).catch(() => undefined);
  }
  await answerCallbackQuery(callbackId, 'Factura descartada');
  await sendTelegramMessage(chatId, `🗑 Factura${numero} descartada.`, { parse_mode: 'HTML' });
}

async function liberarCuarentena(supabase: SupabaseClient, chatId: string, callbackId: string, invoiceId: string): Promise<void> {
  try {
    const { approveAllQualityInspectionsForInvoice } = await import('@/lib/almacen/approveQualityInspection');
    const { aprobadas } = await approveAllQualityInspectionsForInvoice(supabase, invoiceId, null);
    await answerCallbackQuery(callbackId, 'Liberada');
    await sendTelegramMessage(chatId, `✅ Cuarentena liberada: ${aprobadas} línea(s) pasaron al almacén.`, { parse_mode: 'HTML' });
  } catch (e) {
    await answerCallbackQuery(callbackId, e instanceof Error ? e.message.slice(0, 180) : 'No se pudo liberar', true);
  }
}

export async function manejarCallbackTorreControl(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const { chatId, callbackId, data } = params;
  if (!esCallbackTorreControl(data)) return false;
  const adm = await administrador(supabase, chatId);
  if (!adm) {
    await negar(chatId, callbackId);
    return true;
  }

  if (data === CB_NO) {
    await answerCallbackQuery(callbackId, 'Sin cambios');
    return true;
  }
  if (data.startsWith(CB_ETAPA)) {
    const etapa = DE_CODIGO.get(data.slice(CB_ETAPA.length));
    if (!etapa) {
      await answerCallbackQuery(callbackId, 'Etapa no válida', true);
      return true;
    }
    await answerCallbackQuery(callbackId);
    await enviarEtapa(supabase, chatId, etapa, adm.soloObra);
    return true;
  }
  if (data.startsWith(CB_RECORDAR)) {
    const [codigo, id] = data.slice(CB_RECORDAR.length).split(':');
    const etapa = DE_CODIGO.get(codigo ?? '');
    if (!etapa || !id) {
      await answerCallbackQuery(callbackId, 'Pendiente no válido', true);
      return true;
    }
    await recordar(supabase, chatId, callbackId, etapa, id, adm);
    return true;
  }

  const confirmaciones: Array<[string, string, string]> = [
    [CB_CANCELAR_PROCURA, CB_CANCELAR_PROCURA_OK, '¿Cancelar esta procura? Se le avisa a quien la pidió.'],
    [CB_DESCARTAR_FACTURA, CB_DESCARTAR_FACTURA_OK, '¿Descartar esta factura? No se registrará la compra.'],
    [CB_LIBERAR, CB_LIBERAR_OK, '¿Liberar toda la mercancía de esta factura al almacén, sin la verificación del depositario?'],
  ];
  for (const [pide, ok, pregunta] of confirmaciones) {
    if (data.startsWith(pide)) {
      const id = data.slice(pide.length);
      if (!esUuidProcura(id)) {
        await answerCallbackQuery(callbackId, 'Pendiente no válido', true);
        return true;
      }
      const c = confirmar(pregunta, `${ok}${id}`);
      await answerCallbackQuery(callbackId);
      await sendTelegramMessage(chatId, c.texto, { parse_mode: 'HTML', reply_markup: c.reply_markup });
      return true;
    }
  }

  const id = data.slice(data.indexOf(':', PREFIX.length) + 1);
  if (!esUuidProcura(id)) {
    await answerCallbackQuery(callbackId, 'Pendiente no válido', true);
    return true;
  }
  if (data.startsWith(CB_CANCELAR_PROCURA_OK)) await cancelarProcura(supabase, chatId, callbackId, id, adm.nombre);
  else if (data.startsWith(CB_DESCARTAR_FACTURA_OK)) await descartarFactura(supabase, chatId, callbackId, id, adm.nombre);
  else if (data.startsWith(CB_LIBERAR_OK)) await liberarCuarentena(supabase, chatId, callbackId, id);
  else await answerCallbackQuery(callbackId, 'Acción no reconocida', true);
  return true;
}
