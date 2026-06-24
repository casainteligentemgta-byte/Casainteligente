import type { SupabaseClient } from '@supabase/supabase-js';
import { etiquetaContexto, getTelegramEstado } from '@/lib/telegram/estados';
import { resolverEtiquetaRolDestinatario } from '@/lib/telegram/enrutamientoPruebasTelegram';
import { isLogBotConfigured } from '@/lib/telegram/logBotApi';
import { notifyErrorBotAsync } from '@/lib/telegram/notifyErrorBot';
import type { TelegramUpdate } from '@/lib/telegram/webhook';

export type TipoAccionTelegramLog =
  | 'comando'
  | 'callback'
  | 'texto'
  | 'foto'
  | 'documento'
  | 'voz'
  | 'video'
  | 'sistema';

const ICONO_TIPO: Record<TipoAccionTelegramLog, string> = {
  comando: '⌨️',
  callback: '🔘',
  texto: '💬',
  foto: '📷',
  documento: '📎',
  voz: '🎙️',
  video: '🎬',
  sistema: '⚙️',
};

/** Activa auditoría al chat de logs cuando el bot está configurado (opt-out con TELEGRAM_LOG_AUDITORIA=false). */
export function isLogBotAuditoriaActiva(): boolean {
  if (!isLogBotConfigured()) return false;
  const flag = process.env.TELEGRAM_LOG_AUDITORIA?.trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
}

const MAX_DETALLE_LOG_DEFAULT = 200;
const MAX_DETALLE_SISTEMA_CONTABILIDAD = 600;

function truncar(s: string, max = 280): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function maxDetalleLog(tipo: TipoAccionTelegramLog, modulo?: string | null): number {
  if (tipo === 'sistema' && (modulo?.includes('Contabilidad') ?? false)) {
    return MAX_DETALLE_SISTEMA_CONTABILIDAD;
  }
  return MAX_DETALLE_LOG_DEFAULT;
}

export type TelegramLogActor = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramLogChat = {
  id?: number | string;
};

function personajeDesdeTelegram(
  from?: TelegramLogActor | null,
  rolLabel?: string | null,
): string {
  const firstName = from?.first_name?.trim() ?? '';
  const lastName = from?.last_name?.trim() ?? '';
  const nombreCompleto = `${firstName} ${lastName}`.trim();
  const alias = from?.username?.trim() ? ` (@${from.username.trim()})` : '';
  const base = nombreCompleto
    ? `${nombreCompleto}${alias}`
    : from?.id != null
      ? `Usuario ${from.id}`
      : 'Desconocido';
  const rol = rolLabel?.trim();
  return rol && !base.includes(rol) ? `${base} · ${rol}` : base;
}

function truncarUuidCallback(uuid: string): string {
  const id = uuid.trim();
  if (id.length <= 16) return id;
  return `ID: ${id.slice(0, 8)}...${id.slice(-4)}`;
}

/** Traduce callback_data, comando o texto a tipo + detalle legible. */
export function traducirAccionCruda(accionCruda: string): {
  tipoAccion: string;
  detalleAccion: string;
} {
  const raw = accionCruda?.trim() ?? '';
  if (!raw) {
    return { tipoAccion: '❓ Acción Desconocida', detalleAccion: 'Sin datos' };
  }
  if (raw.startsWith('cmp:cap:')) {
    return {
      tipoAccion: '📁 Selección de Capítulo',
      detalleAccion: truncarUuidCallback(raw.replace('cmp:cap:', '')),
    };
  }
  if (raw === 'cmp:mat:txt') {
    return { tipoAccion: '⚙️ Tipo de Entrada', detalleAccion: 'Modo: Texto Libre' };
  }
  if (raw === '[foto]') {
    return { tipoAccion: '📷 Foto', detalleAccion: 'Imagen enviada' };
  }
  if (raw === '[documento]' || raw.startsWith('[documento:')) {
    const nombre = raw.startsWith('[documento:') ? raw.slice('[documento:'.length, -1) : 'Archivo';
    return { tipoAccion: '📎 Documento', detalleAccion: nombre };
  }
  if (raw === '[nota de voz]') {
    return { tipoAccion: '🎙️ Nota de voz', detalleAccion: 'Audio' };
  }
  if (raw === '[video]') {
    return { tipoAccion: '🎬 Video', detalleAccion: 'Video enviado' };
  }
  if (raw.startsWith('/')) {
    return { tipoAccion: '⌨️ Comando Ejecutado', detalleAccion: raw };
  }
  if (raw.includes(':')) {
    return { tipoAccion: '🔘 Interacción', detalleAccion: resumirCallbackTelegram(raw) };
  }
  return { tipoAccion: '💬 Entrada de Texto', detalleAccion: `"${truncar(raw, 200)}"` };
}

/**
 * Log estructurado para acciones del bot operativo (chat de logs).
 * Usa HTML vía notifyErrorBot (etiquetas Personaje/Chat/Flujo/Detalle en negrita).
 */
export function generarLogAccion(
  from: TelegramLogActor | null | undefined,
  chat: TelegramLogChat | null | undefined,
  flujo: string,
  accionCruda: string,
  rolLabel?: string | null,
): string {
  const { tipoAccion, detalleAccion } = traducirAccionCruda(accionCruda);
  const personaje = personajeDesdeTelegram(from, rolLabel);
  const flujoTxt = flujo?.trim() || '—';
  return [
    tipoAccion,
    `Personaje: ${personaje}`,
    `Chat: ${chat?.id ?? 'N/A'}`,
    `Flujo: ${flujoTxt}`,
    `Detalle: ${detalleAccion}`,
  ].join('\n');
}

/** Etiqueta legible para callback_data de botones inline. */
export function resumirCallbackTelegram(data: string): string {
  const d = data.trim();
  if (!d) return 'Botón (sin datos)';
  if (d.startsWith('liberar_factura:')) return 'Destrabar factura OCR';
  if (d.startsWith('log:fnd:')) {
    const parts = d.split(':');
    const fnd = parts[parts.length - 2] ?? '';
    const map: Record<string, string> = { fin: 'financiera', fis: 'física', amb: 'ambas' };
    const label = map[fnd] ?? fnd;
    if (d.includes(':via:si:')) return `Viabilidad procura: confirmar (${label})`;
    if (d.includes(':pm:apr:')) return `Aprobar procura: confirmar (${label})`;
    if (d.includes(':dep:abas:')) return `Verificación almacén: confirmar (${label})`;
    if (d.includes(':com:ord:')) return `Reenviar orden: confirmar (${label})`;
    return `Confirmar supervisor (${label})`;
  }
  if (d.startsWith('log:via:si:')) return 'Viabilidad procura: hay disponibilidad (supervisor)';
  if (d.startsWith('log:via:no:')) return 'Viabilidad procura: sin disponibilidad (supervisor)';
  if (d.startsWith('log:pm:apr:')) return 'Aprobar procura (supervisor)';
  if (d.startsWith('log:pm:rech:')) return 'Rechazar procura (supervisor)';
  if (d.startsWith('log:dep:abas:')) return 'Verificación almacén (supervisor)';
  if (d.startsWith('log:com:orden:')) return 'Reenviar orden compra (supervisor)';
  if (d.startsWith('cmp:via:')) return 'Viabilidad procura (contador)';
  if (d.startsWith('factura_ok')) return 'Confirmar factura OCR';
  if (d.startsWith('factura_moneda:')) return `Moneda factura: ${d.split(':')[1] ?? '—'}`;
  if (d.startsWith('factura_fecha:')) return 'Fecha de factura';
  if (d.startsWith('factura_condicion:')) return `Condición pago: ${d.split(':')[1] ?? '—'}`;
  if (d.startsWith('factura_credito_dias:')) return `Días crédito: ${d.split(':')[1] ?? '—'}`;
  if (d.startsWith('factura_ent:')) return 'Elegir entidad/obra factura';
  if (d.startsWith('proy:')) return 'Elegir obra/proyecto';
  if (d.startsWith('procura')) return 'Procura / abastecimiento';
  if (d.startsWith('prc_')) return 'Procura departamento';
  if (d.startsWith('ing_') || d.startsWith('im_')) return 'Ingreso manual almacén';
  if (d.startsWith('if_')) return 'Ingreso factura depositario';
  if (d.startsWith('dep_rec:')) return 'Recepción física depositario';
  if (d.startsWith('salida')) return 'Salida de material';
  if (d.startsWith('stock')) return 'Consulta stock';
  if (d.startsWith('traspaso')) return 'Traspaso inventario';
  if (d.startsWith('agua')) return 'Registro agua';
  if (d.startsWith('avance')) return 'Avance de campo';
  if (d.startsWith('memoria')) return 'Memoria de obra';
  if (d.startsWith('menu_ing') || d.startsWith('menu_sal')) return 'Menú ingreso/salida';
  if (d.startsWith('cmp_apr')) return 'Aprobación compras';
  if (d.startsWith('viab_admin')) return 'Viabilidad admin procura';
  return truncar(d, 80);
}

export async function notificarAccionTelegramLog(params: {
  chatId: string;
  tipo: TipoAccionTelegramLog;
  accion: string;
  contexto?: string | null;
  detalle?: string | null;
  modulo?: string;
  from?: TelegramLogActor | null;
  chat?: TelegramLogChat | null;
  /** Texto del mensaje o callback_data para generarLogAccion. */
  accionCruda?: string | null;
}): Promise<void> {
  if (!isLogBotAuditoriaActiva()) return;

  const actor = await resolverEtiquetaRolDestinatario(params.chatId);
  const flujo = params.contexto?.trim() || params.modulo?.trim() || '—';

  let mensaje: string;
  if (params.accionCruda != null && params.accionCruda !== '') {
    mensaje = generarLogAccion(
      params.from,
      params.chat ?? { id: params.chatId },
      flujo,
      params.accionCruda,
      actor,
    );
  } else {
    const icono = ICONO_TIPO[params.tipo];
    const lineas = [
      `${icono} ${params.accion}`,
      `Personaje: ${actor}`,
      `Chat: ${params.chatId}`,
    ];
    if (params.contexto?.trim()) lineas.push(`Flujo: ${params.contexto.trim()}`);
    if (params.detalle?.trim()) {
      lineas.push(
        `Detalle: ${truncar(params.detalle.trim(), maxDetalleLog(params.tipo, params.modulo))}`,
      );
    }
    mensaje = lineas.join('\n');
  }

  notifyErrorBotAsync(mensaje, {
    origen: params.modulo?.trim() || 'Telegram · Acción',
  });
}

export function notificarAccionTelegramLogAsync(
  params: Parameters<typeof notificarAccionTelegramLog>[0],
): void {
  void notificarAccionTelegramLog(params).catch((e) => {
    console.warn('[logBotAuditoria]', e instanceof Error ? e.message : e);
  });
}

/** Eventos de backend (OCR, confirmación contable) vinculados a un chat de Telegram. */
export function notificarEventoSistemaLogAsync(params: {
  chatId?: string | null;
  chatLabel?: string | null;
  modulo: string;
  evento: string;
  detalle?: string | null;
}): void {
  if (!isLogBotAuditoriaActiva()) return;

  const cid = params.chatId?.trim();
  if (cid) {
    notificarAccionTelegramLogAsync({
      chatId: cid,
      tipo: 'sistema',
      accion: params.evento,
      detalle: params.detalle,
      modulo: params.modulo,
    });
    return;
  }

  const actor = params.chatLabel?.trim() || 'Sistema';
  const lineas = [`⚙️ ${params.evento}`, `Personaje: ${actor}`];
  if (params.detalle?.trim()) {
    lineas.push(truncar(params.detalle.trim(), maxDetalleLog('sistema', params.modulo)));
  }
  notifyErrorBotAsync(lineas.join('\n'), { origen: params.modulo });
}

function accionCrudaDesdeMensaje(msg: NonNullable<TelegramUpdate['message']>): string {
  const texto = msg.text?.trim() ?? '';
  if (texto) return texto;
  if (msg.photo?.length) {
    return msg.caption?.trim() ? truncar(msg.caption.trim(), 200) : '[foto]';
  }
  if (msg.document?.file_id) {
    const name = msg.document.file_name?.trim();
    if (msg.caption?.trim()) return truncar(msg.caption.trim(), 200);
    return name ? `[documento:${name}]` : '[documento]';
  }
  if (msg.voice?.file_id) return '[nota de voz]';
  if (msg.video?.file_id) {
    return msg.caption?.trim() ? truncar(msg.caption.trim(), 200) : '[video]';
  }
  return '[mensaje]';
}

function tipoMensajeTelegram(msg: NonNullable<TelegramUpdate['message']>): TipoAccionTelegramLog {
  const texto = msg.text?.trim() ?? '';
  if (texto.startsWith('/')) return 'comando';
  if (msg.photo?.length) return 'foto';
  if (msg.document?.file_id) return 'documento';
  if (msg.voice?.file_id) return 'voz';
  if (msg.video?.file_id) return 'video';
  if (texto) return 'texto';
  return 'sistema';
}

/** Registra en el bot de logs cada update de Telegram autorizado (mensaje o callback). */
export async function auditarUpdateTelegramAsync(
  update: TelegramUpdate,
  supabase?: SupabaseClient | null,
): Promise<void> {
  if (!isLogBotAuditoriaActiva()) return;

  const cq = update.callback_query;
  if (cq?.data) {
    const chatId = String(cq.message?.chat?.id ?? cq.from.id);
    let contexto: string | null = null;
    if (supabase) {
      try {
        const est = await getTelegramEstado(supabase, chatId);
        contexto = etiquetaContexto(est.contexto);
      } catch {
        /* ignore */
      }
    }
    notificarAccionTelegramLogAsync({
      chatId,
      tipo: 'callback',
      accion: resumirCallbackTelegram(cq.data),
      contexto,
      from: cq.from,
      chat: cq.message?.chat,
      accionCruda: cq.data,
    });
    return;
  }

  const msg = update.message;
  if (!msg) return;

  const chatId = String(msg.chat.id);
  let contexto: string | null = null;
  if (supabase) {
    try {
      const est = await getTelegramEstado(supabase, chatId);
      contexto = etiquetaContexto(est.contexto);
    } catch {
      /* ignore */
    }
  }

  notificarAccionTelegramLogAsync({
    chatId,
    tipo: tipoMensajeTelegram(msg),
    accion: 'Mensaje Telegram',
    contexto,
    from: msg.from,
    chat: msg.chat,
    accionCruda: accionCrudaDesdeMensaje(msg),
  });
}
