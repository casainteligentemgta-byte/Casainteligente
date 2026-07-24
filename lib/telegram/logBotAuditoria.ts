import type { SupabaseClient } from '@supabase/supabase-js';
import { obtenerUsuarioSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { esUuidProcura, parseMetadataProcuraDepartamento, type PasoProcuraDepartamento } from '@/lib/compras/telegramMetadata';
import {
  etiquetaContexto,
  type TelegramContexto,
  type TelegramEstado,
  getTelegramEstado,
} from '@/lib/telegram/estados';
import { isLogBotConfigured } from '@/lib/telegram/logBotApi';
import { notifyErrorBotAsync } from '@/lib/telegram/notifyErrorBot';
import { primerTokenComando } from '@/lib/telegram/parseComandoTelegram';
import { FLUJO_STOCK_CONSULTA } from '@/lib/telegram/stockConsultaTelegram';
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

function personajeCortoLog(from?: TelegramLogActor | null): string {
  const firstName = from?.first_name?.trim() ?? '';
  const lastName = from?.last_name?.trim() ?? '';
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0).toUpperCase()}`;
  }
  if (firstName) return firstName;
  if (from?.username?.trim()) return from.username.trim();
  return 'Desconocido';
}

const COMANDO_A_CONTEXTO: Record<string, TelegramContexto> = {
  procura: 'procura_solicitud',
  procuras: 'procura_solicitud',
  stock: 'consulta_stock',
  factura: 'factura',
  facturas: 'factura',
  sinnota: 'entrada_obra',
  ingresomanual: 'entrada_obra',
  ingreso: 'entrada_obra',
  ingresofactura: 'entrada_obra',
  ingresofacturas: 'entrada_obra',
  nota: 'entrada_obra',
  notaentrega: 'entrada_obra',
  entrada: 'entrada_obra',
  emergencia: 'entrada_obra',
  urgente: 'entrada_obra',
  ingresoemergencia: 'entrada_obra',
  emergencias: 'entrada_obra',
  salida: 'salida_obra',
  salid: 'salida_obra',
  egreso: 'salida_obra',
  bitacora: 'esperando_audio_bitacora',
  agua: 'obra',
  start: 'menu',
  menu: 'menu',
  inicio: 'menu',
  cancelar: 'menu',
  ayuda: 'menu',
  help: 'menu',
};

function flujoProcuraDepartamentoPorPaso(paso?: PasoProcuraDepartamento): string {
  switch (paso) {
    case 'capitulo':
    case 'nuevo_capitulo':
      return 'Procura · escoger capítulo';
    case 'material':
      return 'Procura · indicar material';
    case 'cantidad':
      return 'Procura · indicar cantidad';
    case 'unidad':
    case 'unidad_texto':
      return 'Procura · elegir unidad';
    case 'prioridad':
      return 'Procura · elegir prioridad';
    case 'consumible':
    case 'monto':
      return 'Procura · confirmar datos';
    case 'confirm':
      return 'Procura · confirmar solicitud';
    default:
      return 'Procura · escoger capítulo';
  }
}

function flujoStockPorPaso(paso?: string): string {
  switch (paso) {
    case 'entidad':
      return 'Consulta de stock · elegir entidad';
    case 'obra':
      return 'Consulta de stock · elegir obra';
    case 'almacen':
      return 'Consulta de stock · elegir almacén';
    case 'listado':
      return 'Consulta de stock · listado';
    default:
      return 'Consulta de stock';
  }
}

function esCallbackProcuraCapitulo(raw: string): boolean {
  return raw.startsWith('cmp:cap:') || raw === 'cmp:cap:nuevo';
}

function esCallbackProcuraObra(raw: string): boolean {
  return raw.startsWith('ps:r:') || raw.startsWith('pp:r:');
}

function esComandoProcura(raw: string): boolean {
  if (!raw.startsWith('/')) return false;
  const cmdKey = primerTokenComando(raw).replace(/^\//, '').toLowerCase();
  return cmdKey === 'procura' || cmdKey === 'procuras';
}

/** Alinea el flujo del log con manejarComandoProcuraDepartamentoTelegram (obra en estado o en usuario). */
async function enriquecerEstadoParaLogProcura(
  supabase: SupabaseClient,
  telegramUserId: string | number,
  estado: TelegramEstado | null,
): Promise<TelegramEstado | null> {
  if (estado?.proyecto_id?.trim()) return estado;
  const usuario = await obtenerUsuarioSistemaTelegram(supabase, telegramUserId);
  const pid = usuario?.proyecto_id?.trim();
  if (!pid) return estado;
  if (!estado) {
    return {
      chat_id: String(telegramUserId),
      contexto: 'menu',
      proyecto_id: pid,
      pending_factura_id: null,
      metadata: {},
    };
  }
  return { ...estado, proyecto_id: pid };
}

function flujoProcuraTrasComando(estado?: TelegramEstado | null): string {
  if (estado?.proyecto_id?.trim()) {
    return 'Procura · escoger capítulo';
  }
  return 'Procura · escoger obra';
}

/** Flujo legible según comando, callback y paso guardado en ci_telegram_estados. */
export function resolverFlujoLogAccion(
  accionCruda: string,
  contextoEstado: string,
  estado?: TelegramEstado | null,
): string {
  const raw = accionCruda.trim();

  if (raw.startsWith('/')) {
    const cmdKey = primerTokenComando(raw).replace(/^\//, '').toLowerCase();
    if (cmdKey === 'procura' || cmdKey === 'procuras') {
      return flujoProcuraTrasComando(estado);
    }
    if (cmdKey === 'stock') {
      return 'Consulta de stock';
    }
    const ctx = COMANDO_A_CONTEXTO[cmdKey];
    if (ctx === 'consulta_stock') return 'Consulta de stock';
    if (ctx) return etiquetaContexto(ctx);
  }

  if (esCallbackProcuraObra(raw)) {
    return 'Procura · escoger obra';
  }

  if (esCallbackProcuraCapitulo(raw)) {
    if (raw === 'cmp:cap:nuevo') {
      return 'Procura · nuevo capítulo';
    }
    return 'Procura · capítulo elegido';
  }

  if (estado) {
    if (estado.contexto === 'consulta_stock') {
      const m = (estado.metadata ?? {}) as { flujo?: string; paso?: string };
      if (m.flujo === FLUJO_STOCK_CONSULTA || raw.startsWith('st:')) {
        return flujoStockPorPaso(m.paso);
      }
      return 'Consulta de stock';
    }

    if (estado.contexto === 'procura_departamento') {
      const metaDep = (estado.metadata ?? {}) as { paso?: PasoProcuraDepartamento };
      if (raw === 'ps:q:' || raw.startsWith('ps:q:')) {
        return 'Procura · escoger obra';
      }
      if (!metaDep.paso && estado.proyecto_id?.trim()) {
        return 'Procura · escoger capítulo';
      }
      return flujoProcuraDepartamentoPorPaso(metaDep.paso);
    }

    if (estado.contexto === 'procura_solicitud') {
      const metaSol = (estado.metadata ?? {}) as { paso?: string };
      const paso = metaSol.paso ?? '';
      if (!estado.proyecto_id && (raw.startsWith('ps:') || raw.startsWith('pp:'))) {
        return 'Procura · escoger obra';
      }
      if (paso === 'material_elegir' || raw.startsWith('prc:')) {
        return 'Procura · elegir material';
      }
      if (paso === 'cantidad') return 'Procura · indicar cantidad';
      if (paso === 'unidad') return 'Procura · elegir unidad';
      if (paso === 'observaciones') return 'Procura · observaciones';
      if (estado.proyecto_id) return 'Procura · solicitud por obra';
      return 'Procura · escoger obra';
    }
  }

  if (raw.startsWith('st:')) {
    return 'Consulta de stock';
  }

  return contextoEstado.trim() || etiquetaContexto('menu');
}

const PREFIJO_CALLBACK_CAPITULO = 'cmp:cap:';
const PREFIJO_CMP = 'cmp:';
const DETALLE_PROCURA_MATERIAL_MANUAL = 'Se ingresó material de manera manual';

function materialProcuraDesdeEstado(estado?: TelegramEstado | null): string | undefined {
  if (!estado) return undefined;
  const m = parseMetadataProcuraDepartamento(estado);
  const txt = m.material_txt?.trim() || m.material_busqueda_borrador?.trim() || '';
  return txt ? truncar(txt, 200) : undefined;
}

/** Detalle legible para callbacks cmp: del flujo procura departamento (sin prefijo técnico). */
function resolverDetalleCmpProcuraDepartamentoLog(
  accionCruda: string,
  _reply_markup?: unknown,
): string | undefined {
  const raw = accionCruda.trim();
  if (!raw.startsWith(PREFIJO_CMP) || raw.startsWith(PREFIJO_CALLBACK_CAPITULO)) {
    return undefined;
  }

  if (raw === 'cmp:ok') return 'OK';
  if (raw === 'cmp:no') return 'Cancelar';
  if (raw === 'cmp:mat:canon') return 'Usar material sugerido';
  if (raw === 'cmp:mat:keep') return 'Mantener texto ingresado';
  if (raw === 'cmp:mat:list') return 'Ver catálogo';

  if (raw.startsWith('cmp:uni:')) {
    const suffix = raw.slice('cmp:uni:'.length);
    if (suffix === 'txt') return 'Escribir unidad';
    return suffix;
  }

  if (raw.startsWith('cmp:pri:')) {
    return raw.slice('cmp:pri:'.length);
  }

  return undefined;
}

function resolverDetalleMensajeProcuraDepartamento(
  accionCruda: string,
  estado?: TelegramEstado | null,
): string | undefined {
  if (!estado || estado.contexto !== 'procura_departamento') return undefined;
  const texto = accionCruda.trim();
  if (!texto || texto.startsWith('/') || texto.startsWith('[')) return undefined;
  const paso = ((estado.metadata ?? {}) as { paso?: PasoProcuraDepartamento }).paso;
  if (paso === 'material') return truncar(texto, 200);
  return undefined;
}

function textoBotonInlineDesdeCallback(data: string, reply_markup?: unknown): string | null {
  if (!reply_markup || typeof reply_markup !== 'object') return null;
  const kb = reply_markup as { inline_keyboard?: { text?: string; callback_data?: string }[][] };
  for (const row of kb.inline_keyboard ?? []) {
    for (const btn of row) {
      if (btn.callback_data === data && btn.text?.trim()) {
        return btn.text.trim();
      }
    }
  }
  return null;
}

/** Nombre del capítulo para Detalle del log (BD → texto del botón → genérico). */
export async function resolverDetalleCapituloProcuraLog(
  supabase: SupabaseClient | null | undefined,
  accionCruda: string,
  reply_markup?: unknown,
): Promise<string | undefined> {
  const raw = accionCruda.trim();
  if (!raw.startsWith(PREFIJO_CALLBACK_CAPITULO)) return undefined;

  const capId = raw.slice(PREFIJO_CALLBACK_CAPITULO.length);
  if (capId === 'nuevo') return 'Crear capítulo';
  if (capId === 'cancel') return 'Cancelar';

  if (supabase && esUuidProcura(capId)) {
    try {
      const { obtenerCapituloMaestroPorId, etiquetaCapituloMaestro } = await import(
        '@/lib/compras/capitulosMaestro'
      );
      const cap = await obtenerCapituloMaestroPorId(supabase, capId);
      if (cap) return etiquetaCapituloMaestro(cap);
    } catch {
      /* ignore */
    }
  }

  const textoBoton = textoBotonInlineDesdeCallback(raw, reply_markup);
  if (textoBoton) {
    return textoBoton.replace(/^➕\s*/, '').trim() || textoBoton;
  }

  return undefined;
}

/** Detalle del log para callbacks procura (capítulo, material, unidad, prioridad, confirmar). */
export async function resolverDetalleCallbackProcuraLog(
  supabase: SupabaseClient | null | undefined,
  accionCruda: string,
  reply_markup?: unknown,
  estadoTelegram?: TelegramEstado | null,
): Promise<string | undefined> {
  const cap = await resolverDetalleCapituloProcuraLog(supabase, accionCruda, reply_markup);
  if (cap) return cap;

  const raw = accionCruda.trim();
  if (raw === 'cmp:mat:txt') {
    return materialProcuraDesdeEstado(estadoTelegram) ?? DETALLE_PROCURA_MATERIAL_MANUAL;
  }
  if (raw === 'cmp:mat:keep' || raw === 'cmp:mat:canon') {
    const mat = materialProcuraDesdeEstado(estadoTelegram);
    if (mat) return mat;
  }

  const cmp = resolverDetalleCmpProcuraDepartamentoLog(accionCruda, reply_markup);
  if (cmp) return cmp;

  if (raw.startsWith('cmp:mat_id:') && supabase) {
    const matId = raw.slice('cmp:mat_id:'.length).trim();
    if (esUuidProcura(matId)) {
      try {
        const { data } = await supabase
          .from('global_inventory')
          .select('nombre')
          .eq('id', matId)
          .maybeSingle();
        const nombre = (data as { nombre?: string } | null)?.nombre?.trim();
        if (nombre) return nombre;
      } catch {
        /* ignore */
      }
    }
  }

  return resolverDetalleMensajeProcuraDepartamento(accionCruda, estadoTelegram);
}

function detalleDesdeAccionCruda(accionCruda: string, detalleOverride?: string | null): string {
  const override = detalleOverride?.trim();
  if (override) return override;

  const raw = accionCruda?.trim() ?? '';
  if (!raw) return 'Sin datos';
  if (raw.startsWith('/')) {
    return raw.split(/\s+/)[0] ?? raw;
  }
  if (raw.startsWith(PREFIJO_CALLBACK_CAPITULO)) {
    const capId = raw.slice(PREFIJO_CALLBACK_CAPITULO.length);
    if (capId === 'nuevo') return 'Crear capítulo';
    if (capId === 'cancel') return 'Cancelar';
    return 'Capítulo seleccionado';
  }
  const cmpDet = resolverDetalleCmpProcuraDepartamentoLog(raw);
  if (cmpDet) return cmpDet;
  if (raw === '[foto]') return 'Foto';
  if (raw === '[documento]' || raw.startsWith('[documento:')) {
    return raw.startsWith('[documento:') ? raw.slice('[documento:'.length, -1) : 'Documento';
  }
  if (raw === '[nota de voz]') return 'Nota de voz';
  if (raw === '[video]') return 'Video';
  if (raw.includes(':')) {
    return resumirCallbackTelegram(raw);
  }
  return truncar(raw, 200);
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
    return { tipoAccion: '⚙️ Tipo de Entrada', detalleAccion: DETALLE_PROCURA_MATERIAL_MANUAL };
  }
  if (raw.startsWith('cmp:uni:')) {
    const suffix = raw.slice('cmp:uni:'.length);
    return {
      tipoAccion: '📏 Unidad de Medida',
      detalleAccion: suffix === 'txt' ? 'Escribir unidad' : suffix,
    };
  }
  if (raw.startsWith('cmp:pri:')) {
    return {
      tipoAccion: '⚡ Prioridad',
      detalleAccion: raw.slice('cmp:pri:'.length),
    };
  }
  if (raw === 'cmp:ok') {
    return { tipoAccion: '✅ Confirmación', detalleAccion: 'OK' };
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
 * Usa HTML vía notifyErrorBot (etiquetas Personaje/Flujo/Detalle en negrita).
 */
export function generarLogAccion(
  from: TelegramLogActor | null | undefined,
  flujo: string,
  accionCruda: string,
  detalleOverride?: string | null,
): string {
  const personaje = personajeCortoLog(from);
  const detalleAccion = detalleDesdeAccionCruda(accionCruda, detalleOverride);
  return [
    `Personaje: ${personaje}`,
    `Flujo: ${flujo}`,
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
  if (d.startsWith(PREFIJO_CALLBACK_CAPITULO)) return 'Selección de capítulo';
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
  estadoTelegram?: TelegramEstado | null;
  /** Texto del mensaje o callback_data para generarLogAccion. */
  accionCruda?: string | null;
  /** Detalle resuelto (p. ej. nombre de capítulo). */
  detalleLog?: string | null;
}): Promise<void> {
  if (!isLogBotAuditoriaActiva()) return;

  const contextoBase =
    params.contexto?.trim() || params.modulo?.trim() || etiquetaContexto('menu');
  const flujoResuelto =
    params.accionCruda != null && params.accionCruda !== ''
      ? resolverFlujoLogAccion(params.accionCruda, contextoBase, params.estadoTelegram)
      : contextoBase;

  let mensaje: string;
  if (params.accionCruda != null && params.accionCruda !== '') {
    mensaje = generarLogAccion(
      params.from,
      flujoResuelto,
      params.accionCruda,
      params.detalleLog,
    );
  } else {
    const detalle = params.detalle?.trim()
      ? truncar(params.detalle.trim(), maxDetalleLog(params.tipo, params.modulo))
      : params.accion;
    mensaje = [
      `Personaje: ${personajeCortoLog(params.from)}`,
      `Flujo: ${flujoResuelto}`,
      `Detalle: ${detalle}`,
    ].join('\n');
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
  const lineas = [
    `Personaje: ${actor}`,
    `Flujo: ${params.modulo.trim()}`,
    `Detalle: ${params.evento}`,
  ];
  if (params.detalle?.trim()) {
    lineas[2] = `Detalle: ${truncar(params.detalle.trim(), maxDetalleLog('sistema', params.modulo))}`;
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
    let estadoTelegram: TelegramEstado | null = null;
    if (supabase) {
      try {
        const est = await getTelegramEstado(supabase, chatId);
        estadoTelegram = est;
        contexto = etiquetaContexto(est.contexto);
      } catch {
        /* ignore */
      }
    }
    const detalleLog = await resolverDetalleCallbackProcuraLog(
      supabase,
      cq.data,
      (cq.message as { reply_markup?: unknown } | undefined)?.reply_markup,
      estadoTelegram,
    );
    notificarAccionTelegramLogAsync({
      chatId,
      tipo: 'callback',
      accion: resumirCallbackTelegram(cq.data),
      contexto,
      from: cq.from,
      chat: cq.message?.chat,
      estadoTelegram,
      accionCruda: cq.data,
      detalleLog,
    });
    return;
  }

  const msg = update.message;
  if (!msg) return;

  const chatId = String(msg.chat.id);
  let contexto: string | null = null;
  let estadoTelegram: TelegramEstado | null = null;
  if (supabase) {
    try {
      const est = await getTelegramEstado(supabase, chatId);
      estadoTelegram = est;
      contexto = etiquetaContexto(est.contexto);
    } catch {
      /* ignore */
    }
  }

  const accionCruda = accionCrudaDesdeMensaje(msg);
  let estadoParaLog = estadoTelegram;
  if (supabase && esComandoProcura(accionCruda)) {
    try {
      estadoParaLog = await enriquecerEstadoParaLogProcura(
        supabase,
        msg.from?.id ?? chatId,
        estadoTelegram,
      );
    } catch {
      /* ignore */
    }
  }
  const detalleLog = resolverDetalleMensajeProcuraDepartamento(accionCruda, estadoParaLog);

  notificarAccionTelegramLogAsync({
    chatId,
    tipo: tipoMensajeTelegram(msg),
    accion: 'Mensaje Telegram',
    contexto,
    from: msg.from,
    chat: msg.chat,
    estadoTelegram: estadoParaLog,
    accionCruda,
    detalleLog,
  });
}
