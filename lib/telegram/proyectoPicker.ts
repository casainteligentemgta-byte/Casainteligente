import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import type { TelegramContexto } from '@/lib/telegram/estados';
import { etiquetaContexto, setTelegramContexto } from '@/lib/telegram/estados';
import {
  loadCatalogoProyectosApp,
  type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import {
  filtrarProyectosCatalogoParaChatTelegram,
  modoTelegramUsaObraComprador,
} from '@/lib/telegram/proyectosTelegramUsuario';

/** Contextos en los que el usuario puede elegir proyecto desde Telegram. */
export type ProyectoPickerModo =
  | Extract<
      TelegramContexto,
      'obra' | 'gasto_obra' | 'esperando_audio_bitacora' | 'entrada_obra' | 'salida_obra' | 'memoria_obra'
    >
  | 'factura_compra'
  | 'factura_comprador_manual'
  | 'ingreso_manual'
  | 'ingreso_factura_manual'
  | 'nota_entrega'
  | 'emergencia'
  | 'procura'
  | 'procura_departamento'
  | 'salida_almacen'
  | 'salida_almacen_dest'
  | 'salida_obra_despacho';

const PAGE_SIZE = 8;

const MODO_CORTO: Record<ProyectoPickerModo, string> = {
  obra: 'o',
  gasto_obra: 'g',
  esperando_audio_bitacora: 'b',
  entrada_obra: 'n',
  salida_obra: 'l',
  salida_almacen: 'w',
  salida_almacen_dest: 'x',
  salida_obra_despacho: 'd',
  memoria_obra: 'm',
  factura_compra: 'f',
  factura_comprador_manual: 'c',
  ingreso_manual: 'h',
  ingreso_factura_manual: 'v',
  nota_entrega: 't',
  emergencia: 'e',
  procura: 'r',
  procura_departamento: 'q',
};

const MODO_LARGO: Record<string, ProyectoPickerModo> = {
  o: 'obra',
  g: 'gasto_obra',
  b: 'esperando_audio_bitacora',
  n: 'entrada_obra',
  l: 'salida_obra',
  w: 'salida_almacen',
  x: 'salida_almacen_dest',
  d: 'salida_obra_despacho',
  m: 'memoria_obra',
  f: 'factura_compra',
  c: 'factura_comprador_manual',
  h: 'ingreso_manual',
  v: 'ingreso_factura_manual',
  t: 'nota_entrega',
  e: 'emergencia',
  r: 'procura',
  q: 'procura_departamento',
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
      return '📥 <b>Elige la obra</b> (ingreso manual):';
    case 'ingreso_manual':
      return '📥 <b>Elige la obra</b> (ingreso manual a almacén):';
    case 'ingreso_factura_manual':
      return '🧾 <b>Elige la obra</b> (ingreso manual de factura):';
    case 'nota_entrega':
      return '📥 <b>Elige la obra</b> (nota de entrega → almacén):';
    case 'emergencia':
      return '🚨 <b>Elige el proyecto</b> (emergencia sin papeles → almacén):';
    case 'procura':
      return '📦 <b>Elige la obra</b> para la solicitud de procura:';
    case 'procura_departamento':
      return '📦 <b>Elige la obra</b> para la nueva procura:';
    case 'salida_obra':
      return '📤 <b>Elige la obra</b> (salida de material):';
    case 'salida_almacen':
    case 'salida_obra_despacho':
      return '📤 <b>Elige la obra de origen</b> (salida desde almacén):';
    case 'salida_almacen_dest':
      return '🏗 <b>Elige la obra de destino</b>:';
    case 'factura_compra':
      return '🏗 <b>Elige la obra</b> de esta compra:';
    case 'factura_comprador_manual':
      return '🏗 <b>Elige la obra</b> (factura manual comprador):';
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
        'También puedes usar /bitacora con este proyecto.'
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
    case 'ingreso_manual':
    case 'ingreso_factura_manual':
    case 'factura_comprador_manual':
    case 'nota_entrega':
    case 'emergencia':
    case 'procura':
    case 'procura_departamento':
    case 'salida_obra':
    case 'salida_almacen':
    case 'salida_almacen_dest':
    case 'salida_obra_despacho':
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

/** Aplica la selección de proyecto (sin callback de Telegram). */
export async function aplicarSeleccionProyectoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  modo: ProyectoPickerModo,
  proyectoId: string,
  nombreObra: string,
): Promise<void> {
  if (modo === 'factura_compra') {
    const estado = await import('@/lib/telegram/estados').then((m) =>
      m.getTelegramEstado(supabase, chatId),
    );
    const pendingId = estado.pending_factura_id;
    if (!pendingId) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Sin factura pendiente. Envía una foto con <code>/facturas</code>.',
        { parse_mode: 'HTML' },
      );
      return;
    }
    await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        proyecto_id: proyectoId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingId);
    const { enviarPickerUbicacionesTelegram } = await import('@/lib/telegram/ubicacionPicker');
    await enviarPickerUbicacionesTelegram(supabase, chatId, {
      pendingId,
      proyectoId,
      nombreObra,
    });
    return;
  }

  if (modo === 'factura_comprador_manual') {
    const { prepararFacturaCompradorManualTrasObra } = await import(
      '@/lib/telegram/facturaCompradorManualTelegram'
    );
    await prepararFacturaCompradorManualTrasObra(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'ingreso_manual') {
    const { prepararIngresoManualTrasObra } = await import('@/lib/telegram/ingresoManualTelegram');
    await prepararIngresoManualTrasObra(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'ingreso_factura_manual') {
    const { prepararIngresoFacturaManualTrasObra } = await import('@/lib/telegram/ingresoManualTelegram');
    await prepararIngresoFacturaManualTrasObra(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'nota_entrega') {
    const { prepararNotaEntregaIngresoTrasObra } = await import('@/lib/telegram/ingresoManualTelegram');
    await prepararNotaEntregaIngresoTrasObra(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'procura') {
    const { prepararProcuraTrasObra } = await import('@/lib/telegram/procuraTelegram');
    await prepararProcuraTrasObra(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'procura_departamento') {
    const estado = await import('@/lib/telegram/estados').then((m) =>
      m.getTelegramEstado(supabase, chatId),
    );
    const meta = (estado.metadata ?? {}) as { usuario_id?: string; usuario_nombre?: string };
    const { continuarProcuraDepartamentoTrasObra } = await import(
      '@/lib/compras/procuraDepartamentoTelegram'
    );
    const { exigirUsuarioSistemaTelegram } = await import(
      '@/lib/compras/usuariosSistemaTelegram'
    );
    let usuarioId = meta.usuario_id?.trim();
    let usuarioNombre = meta.usuario_nombre?.trim();
    if (!usuarioId) {
      const auth = await exigirUsuarioSistemaTelegram(supabase, chatId);
      if (auth.ok) {
        usuarioId = auth.usuario.id;
        usuarioNombre = auth.usuario.nombre;
      }
    }
    await continuarProcuraDepartamentoTrasObra(supabase, chatId, proyectoId, {
      id: usuarioId ?? 'telegram',
      nombre: usuarioNombre ?? nombreObra,
    });
    return;
  }

  if (modo === 'emergencia') {
    const { prepararEmergenciaIngresoTrasObra } = await import('@/lib/telegram/ingresoManualTelegram');
    await prepararEmergenciaIngresoTrasObra(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'salida_obra') {
    const { iniciarSalidaEgresoTrasObra } = await import('@/lib/telegram/salidaEgresoFlujo');
    await iniciarSalidaEgresoTrasObra(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'salida_almacen' || modo === 'salida_obra_despacho') {
    const { prepararSalidaObraTrasProyecto } = await import('@/lib/telegram/salidaObraTelegram');
    await prepararSalidaObraTrasProyecto(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'salida_almacen_dest') {
    const { prepararObraDestinoSalidaAlmacen } = await import('@/lib/telegram/salidaObraTelegram');
    await prepararObraDestinoSalidaAlmacen(supabase, chatId, proyectoId);
    return;
  }

  if (modo === 'memoria_obra') {
    const { enviarPickerPartidasMemoriaObra } = await import('@/lib/telegram/memoriaObra');
    await enviarPickerPartidasMemoriaObra(supabase, chatId, proyectoId);
    return;
  }

  await setTelegramContexto(supabase, chatId, {
    contexto: modo,
    proyecto_id: proyectoId,
  });

  const msg = mensajeTrasSeleccion(modo, nombreObra);
  if (msg) {
    await sendTelegramMessage(chatId, msg, { parse_mode: 'HTML' });
  }
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

  const permitidos = await filtrarProyectosCatalogoParaChatTelegram(supabase, chatId, proyectos);
  if (permitidos.length === 0) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Tu obra asignada no está disponible. Contacta al administrador.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (permitidos.length === 1 && modoTelegramUsaObraComprador(modo)) {
    const unico = permitidos[0]!;
    await sendTelegramMessage(
      chatId,
      `✅ Obra: <b>${unico.nombre}</b>`,
      { parse_mode: 'HTML' },
    );
    await aplicarSeleccionProyectoTelegram(supabase, chatId, modo, unico.id, unico.nombre);
    return;
  }

  const keyboard = buildKeyboard(permitidos, page, modo);
  const totalPages = Math.max(1, Math.ceil(permitidos.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  await sendTelegramMessage(
    chatId,
    `${tituloPicker(modo)}\n<i>Toca un nombre abajo (${permitidos.length} proyectos)</i>`,
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
  const permitidos = await filtrarProyectosCatalogoParaChatTelegram(
    supabase,
    params.chatId,
    proyectos,
  );
  const hit = permitidos.find((p) => p.id === parsed.proyectoId);
  if (!hit) {
    const ajeno = proyectos.find((p) => p.id === parsed.proyectoId);
    if (ajeno && permitidos.length < proyectos.length) {
      await answerCallbackQuery(params.callbackId, 'Solo puedes usar tu obra asignada', true);
    } else {
      await answerCallbackQuery(params.callbackId, 'Proyecto no encontrado', true);
    }
    return true;
  }

  const etiquetaObra =
    parsed.modo === 'salida_almacen_dest' ? `Destino: ${hit.nombre}` : `Obra: ${hit.nombre}`;
  await answerCallbackQuery(params.callbackId, etiquetaObra);
  await aplicarSeleccionProyectoTelegram(
    supabase,
    params.chatId,
    parsed.modo,
    parsed.proyectoId,
    hit.nombre,
  );
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
  return 'Usa <code>/bitacora</code>, <code>/ingreso</code> o <code>/salida</code> para elegir la obra desde una lista.';
}
