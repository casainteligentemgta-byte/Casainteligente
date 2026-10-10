import type { SupabaseClient } from '@supabase/supabase-js';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import {
  chatIdsDesdeDestinatarios,
  resolverDestinatariosCuarentenaTelegram,
} from '@/lib/almacen/resolverDestinatariosCuarentenaTelegram';
import {
  crearRetiroCompra,
  liberarRetiroCompra,
  marcarRetiroCompraEntregado,
  obtenerRetiro,
  registrarFotoRetiroCompra,
  retiroEsperandoFoto,
  tomarRetiroCompra,
  type CrearRetiroCompraInput,
  type RetiroCompra,
} from '@/lib/compras/retiroCompra';
import { esUuidProcura } from '@/lib/compras/telegramMetadata';
import { resolverNombreMostrarTelegram } from '@/lib/procuras/resolverNombreTelegramObra';
import { listarNominaProyecto } from '@/lib/proyectos/proyectoNomina';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { getTelegramEstado } from '@/lib/telegram/estados';

/**
 * Retiro de mercancía comprada, lado Telegram.
 *
 * 1. El comprador confirma la factura → aviso a Logística de la obra y al propio comprador,
 *    con el botón «La retiro yo».
 * 2. Quien lo pulsa queda asignado y debe enviar la foto de la mercancía retirada.
 * 3. Con la foto el retiro pasa a «en camino» y se avisa al almacén de destino.
 * 4. Cuando el almacén registra el ingreso (/ingreso), el retiro se cierra.
 *
 * Quién retira: personal con rol «Logística» en la nómina del proyecto
 * (Proyectos → nómina de la obra). Si la obra no tiene, solo se avisa al comprador.
 */

const PREFIX = 'rt:';
const CB_TOMAR = `${PREFIX}tk:`;
const CB_LIBERAR = `${PREFIX}lb:`;

/** Rol de ci_proyecto_nomina que recibe los avisos de retiro. */
export const ROL_NOMINA_RETIRO = 'logistica';

type Destinatario = { chatId: string; nombre: string; rol: 'Logística' | 'Comprador' };

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function esCallbackRetiroCompra(data: string): boolean {
  return data.startsWith(CB_TOMAR) || data.startsWith(CB_LIBERAR);
}

function tecladoTomar(retiroId: string) {
  return { inline_keyboard: [[{ text: '🚚 La retiro yo', callback_data: `${CB_TOMAR}${retiroId}` }]] };
}

function tecladoLiberar(retiroId: string) {
  return {
    inline_keyboard: [[{ text: '↩️ No puedo retirarla', callback_data: `${CB_LIBERAR}${retiroId}` }]],
  };
}

type ContextoRetiro = { obra: string | null; almacen: string | null; ticket: string | null };

async function cargarContextoRetiro(
  supabase: SupabaseClient,
  retiro: RetiroCompra,
): Promise<ContextoRetiro> {
  const [obra, almacen, procura] = await Promise.all([
    retiro.proyecto_id
      ? supabase.from('ci_proyectos').select('nombre').eq('id', retiro.proyecto_id).maybeSingle()
      : null,
    retiro.ubicacion_destino_id
      ? supabase
          .from('inv_ubicaciones')
          .select('nombre')
          .eq('id', retiro.ubicacion_destino_id)
          .maybeSingle()
      : null,
    retiro.procura_id
      ? supabase.from('ci_procuras').select('ticket').eq('id', retiro.procura_id).maybeSingle()
      : null,
  ]);
  const txt = (v: unknown) => (v == null ? '' : String(v).trim()) || null;
  return {
    obra: txt(obra?.data?.nombre),
    almacen: txt(almacen?.data?.nombre),
    ticket: txt(procura?.data?.ticket),
  };
}

/** Líneas comunes a todos los avisos: factura, proveedor, obra, almacén y ticket. */
export function detalleRetiro(retiro: RetiroCompra, ctx: ContextoRetiro): string {
  return [
    `🧾 Factura <b>#${escHtml(retiro.numero_factura ?? 'S/N')}</b>`,
    `🏢 ${escHtml(retiro.proveedor_nombre ?? 'Proveedor')}`,
    ctx.ticket ? `🎫 ${escHtml(ctx.ticket)}` : null,
    ctx.obra ? `🏗 Obra: <b>${escHtml(ctx.obra)}</b>` : null,
    ctx.almacen ? `📥 Entregar en: <b>${escHtml(ctx.almacen)}</b>` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function destinatariosRetiro(
  supabase: SupabaseClient,
  retiro: RetiroCompra,
): Promise<Destinatario[]> {
  const out = new Map<string, Destinatario>();

  if (retiro.proyecto_id) {
    const nomina = await listarNominaProyecto(supabase, retiro.proyecto_id);
    for (const f of nomina) {
      if (f.rol !== ROL_NOMINA_RETIRO) continue;
      const chat = f.telegram_chat_id ?? f.empleado_telegram_chat_id;
      if (chat == null || !Number.isFinite(Number(chat))) continue;
      const nombre = f.nombre?.trim() || f.nombre_display?.trim() || 'Logística';
      out.set(String(chat), { chatId: String(chat), nombre, rol: 'Logística' });
    }
  }

  if (retiro.solicitado_por_chat_id != null) {
    const chat = String(retiro.solicitado_por_chat_id);
    if (!out.has(chat)) out.set(chat, { chatId: chat, nombre: 'Comprador', rol: 'Comprador' });
  }

  return Array.from(out.values());
}

async function enviarAvisoRetiroPendiente(
  supabase: SupabaseClient,
  retiro: RetiroCompra,
  opts?: { liberadoPor?: string | null },
): Promise<number> {
  const [ctx, destinatarios] = await Promise.all([
    cargarContextoRetiro(supabase, retiro),
    destinatariosRetiro(supabase, retiro),
  ]);
  const hayLogistica = destinatarios.some((d) => d.rol === 'Logística');
  const cabecera = opts?.liberadoPor
    ? `🚚 <b>Retiro disponible de nuevo</b>\n<i>${escHtml(opts.liberadoPor)} no pudo retirarla.</i>`
    : '🚚 <b>Mercancía por retirar</b>';

  let enviados = 0;
  for (const d of destinatarios) {
    const pie =
      d.rol === 'Comprador'
        ? hayLogistica
          ? 'Se avisó a Logística de la obra. Si la lleva usted mismo, pulse el botón.'
          : 'Esta obra no tiene personal de Logística con Telegram. Si la lleva usted, pulse el botón.'
        : 'Si usted la retira, pulse el botón y envíe la foto al recogerla.';
    try {
      await sendTelegramMessage(d.chatId, `${cabecera}\n\n${detalleRetiro(retiro, ctx)}\n\n${pie}`, {
        parse_mode: 'HTML',
        reply_markup: tecladoTomar(retiro.id),
        rolDestinatario: d.rol,
        nombreDestinatario: d.nombre,
        contextoLogEspejo: '[Compra · retiro de mercancía]',
      });
      enviados += 1;
    } catch (e) {
      console.warn('[retiroCompra] aviso pendiente', d.chatId, e);
    }
  }
  return enviados;
}

export type AvisoRetiroCompraResult = {
  ok: boolean;
  avisados: number;
  motivo?: 'sin_migracion' | 'ya_existia' | 'error';
};

/**
 * Llamar cuando la factura quedó confirmada con mercancía pendiente de recibir.
 * No lanza: un fallo aquí nunca debe tumbar la confirmación de la compra.
 */
export async function avisarRetiroCompraPendiente(
  supabase: SupabaseClient,
  input: CrearRetiroCompraInput,
): Promise<AvisoRetiroCompraResult> {
  try {
    const creado = await crearRetiroCompra(supabase, input);
    if (!creado.ok) {
      if (creado.motivo === 'error') console.warn('[retiroCompra] crear:', creado.error);
      return { ok: false, avisados: 0, motivo: creado.motivo };
    }
    if (!creado.creado) return { ok: true, avisados: 0, motivo: 'ya_existia' };
    const avisados = await enviarAvisoRetiroPendiente(supabase, creado.retiro);
    return { ok: true, avisados };
  } catch (e) {
    console.warn('[retiroCompra] avisar pendiente:', e);
    return { ok: false, avisados: 0, motivo: 'error' };
  }
}

async function avisarAlComprador(
  retiro: RetiroCompra,
  quienActua: string | number,
  textoHtml: string,
): Promise<void> {
  const comprador = retiro.solicitado_por_chat_id;
  if (comprador == null || String(comprador) === String(quienActua)) return;
  try {
    await sendTelegramMessage(String(comprador), textoHtml, { parse_mode: 'HTML' });
  } catch (e) {
    console.warn('[retiroCompra] aviso comprador', e);
  }
}

/** Nombre según la nómina de la obra; si no está, el que trae Telegram. */
async function nombreDeQuienRetira(
  supabase: SupabaseClient,
  chatId: string,
  nombreTelegram: string | null | undefined,
  proyectoId: string | null | undefined,
): Promise<string> {
  const fallback = nombreTelegram?.trim() || 'Transportista';
  const id = Number(chatId);
  if (!Number.isFinite(id)) return fallback;
  try {
    return (await resolverNombreMostrarTelegram(supabase, id, fallback, proyectoId)) || fallback;
  } catch {
    return fallback;
  }
}

export async function manejarCallbackRetiroCompra(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; nombre?: string | null },
): Promise<boolean> {
  if (!esCallbackRetiroCompra(params.data)) return false;

  const tomar = params.data.startsWith(CB_TOMAR);
  const retiroId = params.data.slice((tomar ? CB_TOMAR : CB_LIBERAR).length).trim();
  if (!esUuidProcura(retiroId)) {
    await answerCallbackQuery(params.callbackId, 'Retiro no válido', true);
    return true;
  }

  if (!tomar) {
    const liberado = await liberarRetiroCompra(supabase, { retiroId, chatId: params.chatId });
    if (!liberado) {
      await answerCallbackQuery(params.callbackId, 'Este retiro ya no está a su nombre.', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, 'Liberado');
    await sendTelegramMessage(params.chatId, '↩️ Retiro liberado. Se avisó para que otra persona lo tome.', {
      parse_mode: 'HTML',
    });
    await enviarAvisoRetiroPendiente(supabase, liberado, {
      liberadoPor: params.nombre?.trim() || 'Quien lo había tomado',
    });
    return true;
  }

  const previo = await obtenerRetiro(supabase, retiroId);
  const nombre = await nombreDeQuienRetira(supabase, params.chatId, params.nombre, previo?.proyecto_id);
  const tomado = await tomarRetiroCompra(supabase, { retiroId, chatId: params.chatId, nombre });
  if (!tomado) {
    const actual = await obtenerRetiro(supabase, retiroId);
    const motivo = !actual
      ? 'Retiro no encontrado.'
      : actual.estado === 'entregado'
        ? 'Esta mercancía ya fue recibida en almacén.'
        : `Ya lo tomó ${actual.transportista_nombre ?? 'otra persona'}.`;
    await answerCallbackQuery(params.callbackId, motivo, true);
    return true;
  }

  await answerCallbackQuery(params.callbackId, 'Retiro a su nombre');
  const [ctx, estado] = await Promise.all([
    cargarContextoRetiro(supabase, tomado),
    getTelegramEstado(supabase, params.chatId),
  ]);
  // La foto solo se toma con el chat en el menú, para no confundirla con la de otro registro.
  const avisoOtroFlujo =
    estado.contexto === 'menu'
      ? ''
      : '\n\n⚠️ Tiene otro registro abierto en el bot. Termínelo o use <code>/cancelar</code> antes de enviar la foto.';
  await sendTelegramMessage(
    params.chatId,
    `✅ <b>Retiro a su nombre</b>\n\n${detalleRetiro(tomado, ctx)}\n\n` +
      '📷 Al recoger la mercancía, envíe aquí la <b>foto de lo que retira</b> (obligatoria).' +
      avisoOtroFlujo,
    { parse_mode: 'HTML', reply_markup: tecladoLiberar(tomado.id) },
  );
  await avisarAlComprador(
    tomado,
    params.chatId,
    `🚚 <b>${escHtml(nombre)}</b> retirará la factura <b>#${escHtml(tomado.numero_factura ?? 'S/N')}</b>.`,
  );
  return true;
}

/** Qué se le dice a quien retira sobre el aviso al almacén. */
export function mensajeAvisoAlmacenRetiro(avisados: number, quienRetiraEsAlmacen = false): string {
  if (avisados > 0) return 'El almacén ya fue avisado de que va en camino.';
  if (quienRetiraEsAlmacen) {
    return 'Al llegar al almacén, regístrela con <code>/ingreso</code> → facturas precargadas (con foto).';
  }
  return '⚠️ Esta obra no tiene a nadie de almacén con Telegram: <b>avise usted</b> al almacén que va en camino.';
}

/**
 * Foto de la mercancía al retirarla. Solo la toma si este chat tiene un retiro a su
 * nombre esperando foto; si no, devuelve false y el webhook sigue con los demás flujos.
 */
export async function manejarFotoRetiroCompra(params: {
  supabase: SupabaseClient;
  chatId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
}): Promise<boolean> {
  const retiro = await retiroEsperandoFoto(params.supabase, params.chatId);
  if (!retiro) return false;

  const storagePath = `retiros-compra/${retiro.id}/${Date.now()}.${params.ext}`;
  const { error } = await params.supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });
  if (error) {
    await sendTelegramMessage(params.chatId, '❌ No se pudo guardar la foto. Envíela de nuevo.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  const enCamino = await registrarFotoRetiroCompra(params.supabase, { retiro, storagePath });
  if (!enCamino) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ La foto se guardó, pero el retiro ya no estaba a su nombre. Revise con compras.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const ctx = await cargarContextoRetiro(params.supabase, enCamino);
  const detalle = detalleRetiro(enCamino, ctx);
  const quien = enCamino.transportista_nombre ?? 'Transportista';
  const almacen = await resolverDestinatariosCuarentenaTelegram(params.supabase, {
    proyectoId: enCamino.proyecto_id,
    ubicacionDestinoId: enCamino.ubicacion_destino_id,
  });
  let avisadosAlmacen = 0;
  let quienRetiraEsAlmacen = false;
  for (const chatId of chatIdsDesdeDestinatarios(almacen.destinatarios)) {
    if (chatId === params.chatId) {
      quienRetiraEsAlmacen = true;
      continue;
    }
    try {
      await sendTelegramMessage(
        chatId,
        `🚚 <b>Mercancía en camino al almacén</b>\n\n${detalle}\n👤 La trae: <b>${escHtml(quien)}</b>\n\n` +
          'Al recibirla, regístrela con <code>/ingreso</code> → facturas precargadas (con foto).',
        { parse_mode: 'HTML', rolDestinatario: 'Depositario', contextoLogEspejo: '[Compra · en camino]' },
      );
      avisadosAlmacen += 1;
    } catch (e) {
      console.warn('[retiroCompra] aviso almacén', chatId, e);
    }
  }

  // Solo se afirma que el almacén fue avisado si de verdad le llegó a alguien.
  await sendTelegramMessage(
    params.chatId,
    `✅ <b>Retiro registrado con foto</b>\n\n${detalle}\n\n` + mensajeAvisoAlmacenRetiro(avisadosAlmacen, quienRetiraEsAlmacen),
    { parse_mode: 'HTML' },
  );

  await avisarAlComprador(
    enCamino,
    params.chatId,
    `🚚 Factura <b>#${escHtml(enCamino.numero_factura ?? 'S/N')}</b> retirada por <b>${escHtml(quien)}</b>; va en camino al almacén.`,
  );
  return true;
}

/**
 * El almacén registró el ingreso de la factura: cierra el retiro y avisa a quien la traía.
 * No lanza: un fallo aquí nunca debe tumbar el ingreso a almacén.
 */
export async function cerrarRetiroCompraTrasIngreso(
  supabase: SupabaseClient,
  purchaseInvoiceId: string | null | undefined,
): Promise<void> {
  const id = purchaseInvoiceId?.trim();
  if (!id) return;
  try {
    const previo = await marcarRetiroCompraEntregado(supabase, id);
    if (!previo?.transportista_chat_id) return;
    await sendTelegramMessage(
      String(previo.transportista_chat_id),
      `✅ El almacén recibió la factura <b>#${escHtml(previo.numero_factura ?? 'S/N')}</b>` +
        ` (${escHtml(previo.proveedor_nombre ?? 'Proveedor')}). Retiro cerrado.`,
      { parse_mode: 'HTML' },
    );
  } catch (e) {
    console.warn('[retiroCompra] cerrar tras ingreso:', e);
  }
}
