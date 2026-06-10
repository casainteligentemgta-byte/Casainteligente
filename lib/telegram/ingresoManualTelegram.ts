import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asegurarUbicacionObra,
  etiquetaUbicacionSelector,
  listarUbicacionesParaSelector,
} from '@/lib/almacen/ubicacionesInventario';
import { listarMaterialesObraRecepcion } from '@/lib/almacen/listarMaterialesObraRecepcion';
import { listarProveedoresSugeridosIngreso } from '@/lib/almacen/listarProveedoresSugeridosIngreso';
import { normalizarCodigoUnidad, UNIDADES_MEDIDA_DEFAULT } from '@/lib/almacen/unidadesMedidaDefault';
import {
  crearMaterialParaLineaCompra,
  actualizarMaterialExistenteCompra,
  resolverMaterialParaLineaCompra,
} from '@/lib/almacen/resolverMaterialParaCompra';
import {
  asegurarCategoriasCompraSugeridas,
  buscarCategoriaPorId,
} from '@/lib/almacen/categoriasMaterialCompra';
import { sincronizarContabilidadDesdeRecepcionCampo } from '@/lib/contabilidad/sincronizarContabilidadDesdeRecepcionCampo';
import { actualizarProcuraDesdeRecepcionCampo } from '@/lib/procuras/actualizarProcuraDesdeRecepcion';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { extractPurchaseInvoiceFromFile } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import {
  baseUrlApp,
  marcarBorradorRecepcionConsumido,
  nuevoTokenRecepcionCampo,
  urlRecepcionCampoBorrador,
  urlRecepcionCampoDesdeMetadata,
  vistaDesdeFlujoTelegram,
} from '@/lib/almacen/recepcionBorradorTelegram';
import type { LineaRecepcionCampoInput } from '@/lib/almacen/recepcionCampoTypes';
import {
  ETIQUETA_FORMA_INGRESO,
  FORMAS_INGRESO_RECEPCION,
  esFormaIngresoRecepcion,
  formaIngresoDefaultDesdeFlujoTelegram,
  type FormaIngresoRecepcion,
} from '@/lib/almacen/formaIngresoRecepcion';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto, upsertTelegramEstado } from '@/lib/telegram/estados';
import { enviarPickerProyectosTelegram, nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';

export const FLUJO_INGRESO_MANUAL = 'ingreso_manual';
/** Ingreso con datos de factura tecleados (obra → almacén → proveedor → Nº → líneas). */
export const FLUJO_INGRESO_FACTURA_MANUAL = 'ingreso_factura_manual';
/** Ingreso estructurado: obra → almacén → proveedor → nota → materiales → fotos → stock. */
export const FLUJO_NOTA_ENTREGA = 'nota_entrega_ingreso';
export const FLUJO_EMERGENCIA = 'emergencia_ingreso';

export type FlujoRecepcionCampoTelegram =
  | typeof FLUJO_INGRESO_MANUAL
  | typeof FLUJO_INGRESO_FACTURA_MANUAL
  | typeof FLUJO_NOTA_ENTREGA
  | typeof FLUJO_EMERGENCIA;

export type PickerModoRecepcionCampo = 'ingreso_manual' | 'ingreso_factura_manual' | 'nota_entrega' | 'emergencia';

const FLUJOS_RECEPCION_CAMPO = new Set<string>([
  FLUJO_INGRESO_MANUAL,
  FLUJO_INGRESO_FACTURA_MANUAL,
  FLUJO_NOTA_ENTREGA,
  FLUJO_EMERGENCIA,
]);

export type PasoIngresoManual =
  | 'almacen'
  | 'web'
  | 'ocr_factura'
  | 'proveedor'
  | 'num_doc'
  | 'material'
  | 'material_nuevo'
  | 'material_nuevo_unidad'
  | 'categoria'
  | 'cantidad'
  | 'forma_ingreso'
  | 'foto_linea'
  | 'mas_lineas'
  | 'foto'
  | 'observacion'
  | 'confirmar';

export type LineaIngresoManualDraft = {
  material_id: string;
  material_nombre: string;
  unidad: string;
  cantidad: number;
  forma_ingreso: FormaIngresoRecepcion;
  category_id?: string;
  category_nombre?: string;
  soporte_storage_path?: string;
  soporte_file_name?: string;
  soporte_mime_type?: string;
};

export type MetadataIngresoManual = {
  flujo?: string;
  paso?: PasoIngresoManual;
  entidad_id?: string;
  entidad_nombre?: string;
  ubicacion_id?: string;
  ubicacion_nombre?: string;
  proveedor_nombre?: string;
  proveedor_id?: string;
  num_doc?: string;
  lineas?: LineaIngresoManualDraft[];
  draft_material_id?: string;
  draft_material_nombre?: string;
  draft_unidad?: string;
  draft_category_id?: string;
  draft_category_nombre?: string;
  draft_cantidad?: number;
  draft_forma_ingreso?: FormaIngresoRecepcion;
  draft_soporte_storage_path?: string;
  draft_soporte_file_name?: string;
  draft_soporte_mime_type?: string;
  /** Nombre tecleado antes de elegir unidad (material nuevo). */
  draft_nombre_nuevo?: string;
  soporte_storage_path?: string;
  soporte_file_name?: string;
  soporte_mime_type?: string;
  fotos_storage_paths?: string[];
  observaciones?: string;
  telegram_user_id?: string;
  telegram_username?: string | null;
  /** Token opcional para sincronizar borrador con la app (sin redirigir al usuario). */
  /** UUID para precargar /almacen/recepcion?borrador=… */
  recepcion_campo_token?: string;
  recepcion_campo_registrada_id?: string;
  /** /ingreso → ingreso automático: OCR de factura tras elegir almacén. */
  ingreso_ocr_auto?: boolean;
  /** Líneas detectadas por OCR pendientes de categoría/cantidad en bot. */
  ocr_lineas_pendientes?: OcrLineaPendienteIngreso[];
  ocr_aviso_sin_resolver?: string;
};

type OcrLineaPendienteIngreso = {
  material_id: string;
  material_nombre: string;
  unidad: string;
  cantidad: number;
};

const PREFIX = 'im:';
const PAGE_SIZE = 6;
const MIN_PROVEEDOR = 2;

function truncar(s: string, max = 54): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Normaliza nombres legacy (`nota_entrega`) al flujo unificado en bot. */
function normalizarFlujoRecepcionCampo(
  flujo: string | undefined,
): FlujoRecepcionCampoTelegram | undefined {
  if (!flujo?.trim()) return undefined;
  if (flujo === 'nota_entrega') return FLUJO_NOTA_ENTREGA;
  if (FLUJOS_RECEPCION_CAMPO.has(flujo)) return flujo as FlujoRecepcionCampoTelegram;
  return undefined;
}

function meta(estado: TelegramEstado): MetadataIngresoManual {
  const raw = (estado.metadata ?? {}) as MetadataIngresoManual;
  const flujoNorm = normalizarFlujoRecepcionCampo(raw.flujo);
  if (flujoNorm && flujoNorm !== raw.flujo) {
    return { ...raw, flujo: flujoNorm };
  }
  return raw;
}

async function aplicarMetadataFlujoRecepcionCampo(
  supabase: SupabaseClient,
  chatId: string,
  params: {
    flujo: FlujoRecepcionCampoTelegram;
    proyectoId: string | null;
    entidad_id?: string | null;
    entidad_nombre?: string | null;
    extra?: Partial<MetadataIngresoManual>;
  },
): Promise<void> {
  const estadoPrev = await getTelegramEstado(supabase, chatId);
  const token = tokenBorradorRecepcion(params.flujo, estadoPrev) ?? undefined;
  const metadata: MetadataIngresoManual = {
    flujo: params.flujo,
    paso: 'almacen',
    lineas: [],
    fotos_storage_paths: [],
    ...(params.entidad_id
      ? { entidad_id: params.entidad_id, entidad_nombre: params.entidad_nombre ?? undefined }
      : {}),
    ...(token ? { recepcion_campo_token: token } : {}),
    ...params.extra,
  };
  await upsertTelegramEstado(supabase, {
    chat_id: chatId,
    contexto: 'entrada_obra',
    proyecto_id: params.proyectoId,
    pending_factura_id: null,
    metadata: metadata as Record<string, unknown>,
  });
}

export function esFlujoIngresoManual(estado: TelegramEstado): boolean {
  const flujo = meta(estado).flujo;
  return estado.contexto === 'entrada_obra' && Boolean(flujo && FLUJOS_RECEPCION_CAMPO.has(flujo));
}

function flujoActivo(estado: TelegramEstado): FlujoRecepcionCampoTelegram | undefined {
  const f = meta(estado).flujo;
  if (f && FLUJOS_RECEPCION_CAMPO.has(f)) return f as FlujoRecepcionCampoTelegram;
  return undefined;
}

function esNotaEntregaIngreso(estado: TelegramEstado): boolean {
  return flujoActivo(estado) === FLUJO_NOTA_ENTREGA;
}

function esEmergenciaIngreso(estado: TelegramEstado): boolean {
  return flujoActivo(estado) === FLUJO_EMERGENCIA;
}

function esIngresoGuiadoObra(estado: TelegramEstado): boolean {
  const f = flujoActivo(estado);
  return f === FLUJO_NOTA_ENTREGA || f === FLUJO_EMERGENCIA;
}

function tipoRpcRecepcion(flujo: string | undefined): 'nota_entrega' | 'emergencia' | 'factura_canal' {
  if (flujo === FLUJO_EMERGENCIA) return 'emergencia';
  if (flujo === FLUJO_INGRESO_FACTURA_MANUAL) return 'factura_canal';
  return 'nota_entrega';
}

function etiquetaOrigen(flujo: string | undefined): string {
  if (flujo === FLUJO_EMERGENCIA) return 'ingreso emergencia (Telegram)';
  if (flujo === FLUJO_NOTA_ENTREGA) return 'nota de entrega (Telegram)';
  if (flujo === FLUJO_INGRESO_FACTURA_MANUAL) return 'ingreso manual de factura (Telegram)';
  return 'ingreso manual (Telegram)';
}

export function esCallbackIngresoManual(data: string): boolean {
  return data.startsWith(PREFIX);
}

function flujoUsaBorradorWeb(flujo: string | undefined): boolean {
  return (
    flujo === FLUJO_INGRESO_MANUAL ||
    flujo === FLUJO_INGRESO_FACTURA_MANUAL ||
    flujo === FLUJO_NOTA_ENTREGA ||
    flujo === FLUJO_EMERGENCIA
  );
}

/** Flujo guiado completo en Telegram (obra → almacén → proveedor → líneas → fotos → registro). */
function flujoTelegramCompletoEnBot(flujo: string | undefined): boolean {
  return (
    flujo === FLUJO_INGRESO_FACTURA_MANUAL ||
    flujo === FLUJO_NOTA_ENTREGA ||
    flujo === FLUJO_EMERGENCIA
  );
}

function flujoUsaHandoffWebTrasAlmacen(flujo: string | undefined): boolean {
  return normalizarFlujoRecepcionCampo(flujo) === FLUJO_INGRESO_MANUAL;
}

function ingresoFacturaPideCategoriaPorLinea(flujo: string | undefined): boolean {
  return flujoTelegramCompletoEnBot(flujo);
}

async function resolverEntidadMetadataProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<{ entidad_id: string | null; entidad_nombre: string | null }> {
  const entidad_id = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);
  if (!entidad_id) return { entidad_id: null, entidad_nombre: null };

  const { data: ent } = await supabase
    .from('ci_entidades')
    .select('nombre, nombre_abreviado')
    .eq('id', entidad_id)
    .maybeSingle();

  const entidad_nombre =
    String(ent?.nombre_abreviado ?? ent?.nombre ?? '').trim() || null;
  return { entidad_id, entidad_nombre };
}

function tokenBorradorRecepcion(
  flujo: FlujoRecepcionCampoTelegram,
  estadoPrev?: TelegramEstado,
): string | undefined {
  if (!flujoUsaBorradorWeb(flujo)) return undefined;
  const prev = estadoPrev ? meta(estadoPrev) : undefined;
  if (prev?.flujo === flujo && prev.recepcion_campo_token?.trim()) {
    return prev.recepcion_campo_token.trim();
  }
  return nuevoTokenRecepcionCampo();
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: Partial<MetadataIngresoManual>,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function urlRecepcionDesdeMetadata(m: MetadataIngresoManual): string | null {
  const linkMeta = urlRecepcionCampoDesdeMetadata(m as Record<string, unknown>);
  if (linkMeta) return linkMeta;
  const token = m.recepcion_campo_token?.trim();
  const vista = vistaDesdeFlujoTelegram(m.flujo);
  if (!token || !vista) return null;
  return urlRecepcionCampoBorrador(token, vista);
}

/** Tras elegir almacén: obra/ubicación en borrador web; el resto se completa en /almacen/recepcion. */
async function enviarHandoffRecepcionWebTrasAlmacen(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  ubicacionId: string,
  ubicacionNombre: string,
): Promise<void> {
  const m = meta(estado);
  const flujo = m.flujo as FlujoRecepcionCampoTelegram | undefined;
  const token =
    m.recepcion_campo_token?.trim() ||
    (flujo ? tokenBorradorRecepcion(flujo, estado) : undefined) ||
    nuevoTokenRecepcionCampo();

  await patchMeta(supabase, chatId, estado, {
    paso: 'web',
    ubicacion_id: ubicacionId,
    ubicacion_nombre: ubicacionNombre,
    recepcion_campo_token: token,
  });

  const vista = vistaDesdeFlujoTelegram(flujo);
  const link = vista
    ? urlRecepcionCampoBorrador(token, vista)
    : `${baseUrlApp()}/almacen/recepcion?borrador=${encodeURIComponent(token)}`;

  const etiquetaFlujo =
    flujo === FLUJO_INGRESO_FACTURA_MANUAL ? 'ingreso de factura'
    : flujo === FLUJO_NOTA_ENTREGA ? 'nota de entrega'
    : flujo === FLUJO_EMERGENCIA ? 'ingreso de emergencia'
    : 'ingreso manual';

  await sendTelegramMessage(
    chatId,
    `✅ Almacén: <b>${escHtml(ubicacionNombre)}</b>\n\n` +
      `🌐 Complete el <b>${etiquetaFlujo}</b> en la app: proveedor, documento, materiales y confirmación.\n` +
      'Obra y almacén ya están precargados desde Telegram.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Abrir recepción en la app', url: link }]],
      },
    },
  );
}

export async function manejarComandoRecepcionTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  const m = meta(estado);
  const linkActivo = urlRecepcionCampoDesdeMetadata(m as Record<string, unknown>);

  if (linkActivo) {
    await sendTelegramMessage(
      chatId,
      '📦 <b>Recepción en curso</b>\n\n' +
        'Tiene un borrador activo desde Telegram. Abra la pantalla web para completar proveedor, ' +
        'materiales y registrar en <code>ci_recepciones_campo</code>.\n\n' +
        `<a href="${linkActivo}">Abrir /almacen/recepcion</a>`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (m.recepcion_campo_registrada_id?.trim()) {
    await sendTelegramMessage(
      chatId,
      '✅ <b>Recepción ya registrada</b>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const linkBase = `${baseUrlApp()}/almacen/recepcion`;
  await sendTelegramMessage(
    chatId,
    '📦 <b>Recepción en campo</b>\n\n' +
      'Registre ingresos manuales, notas de entrega, emergencias o facturas en tránsito.\n\n' +
      `<a href="${linkBase}">Abrir pantalla de recepción</a>\n\n` +
      'Para iniciar desde Telegram con sincronización web, use:\n' +
      '• <code>/ingreso</code> — menú de ingresos\n' +
      '• <code>/nota</code> — nota de entrega\n' +
      '• <code>/emergencia</code> — sin papeles\n' +
      '• <code>/ingresomanual</code> — ingreso sin nota',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Abrir recepción web', url: linkBase }]],
      },
    },
  );
}

const PASOS_RECEPCION_WEB =
  '3️⃣ Al elegir almacén, abra la <b>recepción en la app</b> y complete proveedor, documento, materiales y confirmación.\n\n' +
  '<code>/cancelar</code> para abortar.';

const FLUJO_PASOS_ARTICULOS_REGISTRO =
  '5️⃣ <b>Artículos a ingresar</b>: material de la obra o nuevo; elige <b>categoría</b> por línea.\n' +
  '6️⃣ Indica la <b>cantidad</b> de cada artículo.\n' +
  '7️⃣ <b>¿Agregar más artículos?</b>\n' +
  '8️⃣ <b>Soporte fotográfico</b> (opcional).\n' +
  '9️⃣ <b>Observaciones</b> (opcional) y <b>registrar ingreso</b> (stock + contabilidad provisional).\n\n' +
  '<code>/cancelar</code> para abortar.';

const FLUJO_PASOS_FACTURA_MANUAL =
  '1️⃣ Elige la <b>obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b> de ingreso.\n' +
  '3️⃣ <b>Elige o escribe</b> el <b>proveedor</b> (lista o nombre nuevo).\n' +
  '4️⃣ Escribe el <b>número de factura</b> (<code>S/N</code> si no hay).\n' +
  FLUJO_PASOS_ARTICULOS_REGISTRO;

const FLUJO_PASOS_FACTURA_AUTO =
  '1️⃣ Elige la <b>obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b> de ingreso.\n' +
  '3️⃣ <b>Elige o escribe</b> el <b>proveedor</b> (lista o nombre nuevo).\n' +
  '4️⃣ Envíe <b>foto o PDF</b> de la factura (IA) o escriba el <b>número de factura</b> (<code>S/N</code> si no hay).\n' +
  FLUJO_PASOS_ARTICULOS_REGISTRO;

const FLUJO_PASOS_NOTA_ENTREGA =
  '1️⃣ Elige la <b>obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b> de ingreso.\n' +
  '3️⃣ <b>Elige o escribe</b> el <b>proveedor</b> (lista o nombre nuevo).\n' +
  '4️⃣ Escribe el <b>número de la nota de entrega</b> (<code>S/N</code> si no hay).\n' +
  FLUJO_PASOS_ARTICULOS_REGISTRO;

const FLUJO_PASOS_SIN_NOTA =
  '1️⃣ Elige la <b>obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b> de ingreso.\n' +
  '3️⃣ <b>Elige o escribe</b> el <b>proveedor</b> (lista o nombre nuevo).\n' +
  '4️⃣ Escribe una <b>referencia</b> del ingreso (<code>S/N</code> si no hay documento).\n' +
  FLUJO_PASOS_ARTICULOS_REGISTRO;

const FLUJO_PASOS_EMERGENCIA = FLUJO_PASOS_SIN_NOTA;

const MENSAJE_INICIO_FACTURA_MANUAL =
  '🧾 <b>Ingreso manual de factura</b> (<code>/ingreso</code>)\n\n' + FLUJO_PASOS_FACTURA_MANUAL;

const MENSAJE_INICIO_MANUAL =
  '📝 <b>Ingreso sin nota</b> (<code>/ingreso</code>)\n\n' + FLUJO_PASOS_SIN_NOTA;

const MENSAJE_INICIO_NOTA =
  '📄 <b>Ingreso con nota de entrega</b> (<code>/ingreso</code>)\n\n' + FLUJO_PASOS_NOTA_ENTREGA;

const MENSAJE_INICIO_EMERGENCIA =
  '📝 <b>Ingreso sin nota de entrega</b> (<code>/ingreso</code>)\n\n' + FLUJO_PASOS_EMERGENCIA;

function mensajeInicioFlujo(flujo: FlujoRecepcionCampoTelegram): string {
  if (flujo === FLUJO_INGRESO_FACTURA_MANUAL) return MENSAJE_INICIO_FACTURA_MANUAL;
  if (flujo === FLUJO_NOTA_ENTREGA) return MENSAJE_INICIO_NOTA;
  if (flujo === FLUJO_EMERGENCIA) return MENSAJE_INICIO_EMERGENCIA;
  return MENSAJE_INICIO_MANUAL;
}

async function iniciarFlujoRecepcionCampo(
  supabase: SupabaseClient,
  chatId: string,
  flujo: FlujoRecepcionCampoTelegram,
  pickerModo: PickerModoRecepcionCampo,
  extraMeta?: Partial<MetadataIngresoManual>,
): Promise<void> {
  await aplicarMetadataFlujoRecepcionCampo(supabase, chatId, {
    flujo,
    proyectoId: null,
    extra: extraMeta,
  });
  const intro =
    extraMeta?.ingreso_ocr_auto && flujo === FLUJO_INGRESO_FACTURA_MANUAL
      ? '🤖 <b>Ingreso automático de factura</b> (<code>/ingreso</code>)\n\n' + FLUJO_PASOS_FACTURA_AUTO
      : mensajeInicioFlujo(flujo);
  await sendTelegramMessage(chatId, intro, { parse_mode: 'HTML' });
  await enviarPickerProyectosTelegram(supabase, chatId, pickerModo);
}

export async function manejarComandoIngresoManualTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await iniciarFlujoRecepcionCampo(supabase, chatId, FLUJO_INGRESO_MANUAL, 'ingreso_manual');
}

/** /ingreso → Ingreso automático de factura (OCR depositario → almacén + contabilidad). */
export async function manejarComandoIngresoFacturaOcrAutomaticoTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await iniciarFlujoRecepcionCampo(
    supabase,
    chatId,
    FLUJO_INGRESO_FACTURA_MANUAL,
    'ingreso_factura_manual',
    { ingreso_ocr_auto: true },
  );
}

/** /ingreso → Ingreso manual de factura: obra, almacén, proveedor, Nº factura, materiales. */
export async function manejarComandoIngresoFacturaManualTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await iniciarFlujoRecepcionCampo(
    supabase,
    chatId,
    FLUJO_INGRESO_FACTURA_MANUAL,
    'ingreso_factura_manual',
  );
}

/** Ingreso sin nota: mismo flujo guiado en Telegram que factura manual (tipo emergencia en stock). */
export async function manejarComandoIngresoSinNotaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await iniciarFlujoRecepcionCampo(supabase, chatId, FLUJO_EMERGENCIA, 'emergencia');
}

/** Nota de entrega sin factura: mismo flujo estructurado con registro de stock inmediato. */
export async function manejarComandoNotaEntregaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await iniciarFlujoRecepcionCampo(supabase, chatId, FLUJO_NOTA_ENTREGA, 'nota_entrega');
}

/** Emergencia sin papeles: mismo flujo guiado, tipo emergencia en recepción de campo. */
export async function manejarComandoEmergenciaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await iniciarFlujoRecepcionCampo(supabase, chatId, FLUJO_EMERGENCIA, 'emergencia');
}

export async function prepararIngresoManualTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  flujo: FlujoRecepcionCampoTelegram = FLUJO_INGRESO_MANUAL,
): Promise<void> {
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await asegurarUbicacionObra(supabase, proyectoId, nombre);
  const estadoPrev = await getTelegramEstado(supabase, chatId);
  const prevMeta = meta(estadoPrev);
  const { entidad_id, entidad_nombre } = await resolverEntidadMetadataProyecto(supabase, proyectoId);
  await aplicarMetadataFlujoRecepcionCampo(supabase, chatId, {
    flujo,
    proyectoId,
    entidad_id,
    entidad_nombre,
    extra:
      flujo === FLUJO_INGRESO_FACTURA_MANUAL &&
      prevMeta.flujo === FLUJO_INGRESO_FACTURA_MANUAL &&
      prevMeta.ingreso_ocr_auto
        ? { ingreso_ocr_auto: true }
        : undefined,
  });
  await enviarPickerAlmacenIngresoManual(supabase, chatId, proyectoId, nombre, 0, entidad_nombre);
}

export async function prepararNotaEntregaIngresoTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  await prepararIngresoManualTrasObra(supabase, chatId, proyectoId, FLUJO_NOTA_ENTREGA);
}

export async function prepararEmergenciaIngresoTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  await prepararIngresoManualTrasObra(supabase, chatId, proyectoId, FLUJO_EMERGENCIA);
}

export async function prepararIngresoFacturaManualTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  await prepararIngresoManualTrasObra(supabase, chatId, proyectoId, FLUJO_INGRESO_FACTURA_MANUAL);
}

async function enviarPickerAlmacenIngresoManual(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  nombreObra: string,
  page = 0,
  entidadNombre?: string | null,
): Promise<void> {
  const ubicaciones = await listarUbicacionesParaSelector(supabase, {
    proyectoId,
    soloAlmacenes: true,
  });

  if (!ubicaciones.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay almacenes configurados para esta obra. Créalos en la app web.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(ubicaciones.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = ubicaciones.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const byId = new Map(ubicaciones.map((u) => [u.id, u]));

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => {
    let nivel = 0;
    let pid = u.ubicacion_padre_id;
    while (pid && nivel < 5) {
      nivel += 1;
      pid = byId.get(pid)?.ubicacion_padre_id;
    }
    return [
      {
        text: truncar(etiquetaUbicacionSelector(u, nivel)),
        callback_data: `${PREFIX}ub:${u.id}`,
      },
    ];
  });

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}ubp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}ubp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}ubp:${safePage + 1}` });
    buttons.push(nav);
  }

  const entidadLine = entidadNombre?.trim()
    ? `\n🏢 Entidad: <b>${escHtml(entidadNombre.trim())}</b>`
    : '';
  const estado = await getTelegramEstado(supabase, chatId);
  const pasoAlmacen = flujoTelegramCompletoEnBot(flujoActivo(estado)) ? '2️⃣ ' : '';
  const tituloAlmacen = flujoTelegramCompletoEnBot(flujoActivo(estado))
    ? `${pasoAlmacen}<b>Elige el almacén de ingreso</b>`
    : '🏭 <b>Elige el almacén de ingreso</b>';

  await sendTelegramMessage(
    chatId,
    `${tituloAlmacen}\nObra: <b>${escHtml(nombreObra)}</b>${entidadLine}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

function promptNumDocTrasProveedor(
  flujo: FlujoRecepcionCampoTelegram | undefined,
  proveedorNombre: string,
  ingresoOcrAuto?: boolean,
): string {
  const prov = escHtml(proveedorNombre);
  if (ingresoOcrAuto && flujo === FLUJO_INGRESO_FACTURA_MANUAL) {
    return (
      `🏢 Proveedor: <b>${prov}</b>\n\n` +
      '4️⃣ Envíe <b>foto o PDF</b> de la factura (IA leerá número y artículos).\n\n' +
      'También puede escribir el <b>número de factura</b> (<code>S/N</code> si no hay) para cargar artículos manualmente.'
    );
  }
  if (flujo === FLUJO_INGRESO_FACTURA_MANUAL) {
    return `🏢 Proveedor: <b>${prov}</b>\n\n4️⃣ 📄 Escribe el <b>número de factura</b> (<code>S/N</code> si no hay):`;
  }
  if (flujo === FLUJO_NOTA_ENTREGA) {
    return `🏢 Proveedor: <b>${prov}</b>\n\n4️⃣ 📄 Escribe el <b>número de la nota de entrega</b> (<code>S/N</code> si no hay):`;
  }
  if (flujo === FLUJO_EMERGENCIA) {
    return `🏢 Proveedor: <b>${prov}</b>\n\n4️⃣ 📄 Escribe una <b>referencia</b> del ingreso (<code>S/N</code> si no hay documento):`;
  }
  return `🏢 Proveedor: <b>${prov}</b>\n\n📄 Escribe el <b>número o referencia</b> (<code>S/N</code> si no hay):`;
}

async function avanzarTrasProveedor(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  params: {
    proveedorNombre: string;
    proveedorId?: string | null;
    telegramUserId?: string;
    telegramUsername?: string | null;
  },
): Promise<void> {
  const flujo = flujoActivo(estado);
  const m = meta(estado);
  const pasoSiguiente =
    m.ingreso_ocr_auto && flujo === FLUJO_INGRESO_FACTURA_MANUAL ? 'ocr_factura' : 'num_doc';

  await patchMeta(supabase, chatId, estado, {
    paso: pasoSiguiente,
    proveedor_nombre: params.proveedorNombre.trim(),
    proveedor_id: params.proveedorId?.trim() || undefined,
    telegram_user_id: params.telegramUserId,
    telegram_username: params.telegramUsername ?? null,
  });
  await sendTelegramMessage(
    chatId,
    promptNumDocTrasProveedor(flujo, params.proveedorNombre, m.ingreso_ocr_auto),
    { parse_mode: 'HTML' },
  );
}

async function cargarCategoriaMaterialInventario(
  supabase: SupabaseClient,
  materialId: string,
): Promise<{ id: string; nombre: string } | null> {
  const { data: row } = await supabase
    .from('global_inventory')
    .select('category_id')
    .eq('id', materialId)
    .maybeSingle();
  const catId = String(row?.category_id ?? '').trim();
  if (!catId) return null;
  const categorias = await asegurarCategoriasCompraSugeridas(supabase);
  const hit = buscarCategoriaPorId(categorias, catId);
  return hit ? { id: hit.id, nombre: hit.name } : null;
}

async function iniciarSiguienteLineaOcrPendiente(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  const pendientes = m.ocr_lineas_pendientes ?? [];

  if (!pendientes.length) {
    const lineas = m.lineas ?? [];
    const avisoOcr = m.ocr_aviso_sin_resolver?.trim();
    if (!lineas.length) {
      await patchMeta(supabase, chatId, estado, {
        paso: 'material',
        ocr_aviso_sin_resolver: undefined,
      });
      const msg = avisoOcr
        ? `⚠️ ${avisoOcr}\n\n5️⃣ Elija artículos manualmente:`
        : '5️⃣ Elige artículo del catálogo de la obra o agrega material nuevo:';
      await sendTelegramMessage(chatId, msg, { parse_mode: 'HTML' });
      if (estado.proyecto_id) {
        await enviarPickerMaterialIngresoManual(supabase, chatId, estado.proyecto_id);
      }
      return;
    }
    if (avisoOcr) {
      await sendTelegramMessage(chatId, `⚠️ ${avisoOcr}`, { parse_mode: 'HTML' });
      await patchMeta(supabase, chatId, estado, { ocr_aviso_sin_resolver: undefined });
    }
    await preguntarMasLineas(supabase, chatId, lineas.length);
    return;
  }

  const [head, ...rest] = pendientes;
  const totalOcr = (m.lineas?.length ?? 0) + pendientes.length;
  const idx = (m.lineas?.length ?? 0) + 1;

  await patchMeta(supabase, chatId, estado, {
    ocr_lineas_pendientes: rest,
    draft_material_id: head.material_id,
    draft_material_nombre: head.material_nombre,
    draft_unidad: head.unidad,
    draft_cantidad: head.cantidad,
    paso: 'categoria',
  });

  await sendTelegramMessage(
    chatId,
    `🤖 Artículo ${idx} de ${totalOcr} (IA): <b>${escHtml(head.material_nombre)}</b>`,
    { parse_mode: 'HTML' },
  );

  const cat = await cargarCategoriaMaterialInventario(supabase, head.material_id);
  if (cat) {
    await aplicarCategoriaMaterialDraft(
      supabase,
      chatId,
      await getTelegramEstado(supabase, chatId),
      cat.id,
      cat.nombre,
    );
  } else {
    await enviarPickerCategoriaMaterialIngreso(supabase, chatId, head.material_nombre);
  }
}

async function continuarTrasNumDocIngreso(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  numDoc: string,
): Promise<void> {
  await patchMeta(supabase, chatId, estado, { paso: 'material', num_doc: numDoc });
  const flujoMat = flujoActivo(estado);
  const etiquetaDoc =
    flujoMat === FLUJO_INGRESO_FACTURA_MANUAL
      ? 'Factura'
      : flujoMat === FLUJO_NOTA_ENTREGA
        ? 'Nota'
        : 'Ref.';
  const promptMat = flujoTelegramCompletoEnBot(flujoMat)
    ? `📄 ${etiquetaDoc}: <b>${numDoc}</b>\n\n5️⃣ Elige artículo del catálogo de la obra o agrega material nuevo:`
    : `📄 Ref.: <b>${numDoc}</b>\n\nElige el material del catálogo o crea uno nuevo:`;
  await sendTelegramMessage(chatId, promptMat, { parse_mode: 'HTML' });
  if (estado.proyecto_id) {
    await enviarPickerMaterialIngresoManual(supabase, chatId, estado.proyecto_id);
  }
}

async function enviarPickerProveedorIngresoManual(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  ubicacionNombre: string,
  page = 0,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, { paso: 'proveedor' });

  const proveedores = await listarProveedoresSugeridosIngreso(supabase, proyectoId);
  const totalPages = Math.max(1, Math.ceil(proveedores.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = proveedores.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => [
    {
      text: truncar(`🏢 ${p.nombre}`),
      callback_data: p.empresasId
        ? `${PREFIX}prve:${p.empresasId}`
        : `${PREFIX}prvk:${p.key}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}prvp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}prvp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}prvp:${safePage + 1}` });
    buttons.push(nav);
  }

  buttons.push([{ text: '✏️ Escribir otro proveedor', callback_data: `${PREFIX}prv:otro` }]);

  const listaHint = proveedores.length
    ? 'Elige un proveedor de la lista o escribe otro nombre.'
    : 'No hay proveedores precargados. Escribe el nombre del proveedor.';

  await sendTelegramMessage(
    chatId,
    `✅ Almacén: <b>${escHtml(ubicacionNombre)}</b>\n\n` +
      `3️⃣ <b>Proveedor</b>: ${listaHint}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function resolverDepositIdDesdeUbicacion(
  supabase: SupabaseClient,
  ubicacionId: string | undefined,
): Promise<string | null> {
  const ubId = ubicacionId?.trim();
  if (!ubId) return null;
  const { data } = await supabase
    .from('inv_ubicaciones')
    .select('deposit_id')
    .eq('id', ubId)
    .maybeSingle();
  return data?.deposit_id ? String(data.deposit_id) : null;
}

async function enviarPickerCategoriaMaterialIngreso(
  supabase: SupabaseClient,
  chatId: string,
  materialNombre: string,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, { paso: 'categoria' });

  const categorias = await asegurarCategoriasCompraSugeridas(supabase);
  if (!categorias.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay categorías de material configuradas. Créelas en la app web.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = categorias.map((c) => [
    {
      text: truncar(c.name, 40),
      callback_data: `${PREFIX}cat:${c.id}`,
    },
  ]);

  await sendTelegramMessage(
    chatId,
    `5️⃣ 📂 <b>Categoría del material</b>\n«${escHtml(truncar(materialNombre, 40))}»\n\nElige la categoría:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function promptCantidadMaterialDraft(
  supabase: SupabaseClient,
  chatId: string,
  params: { nombre: string; unidad: string; creado?: boolean },
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, { paso: 'cantidad' });

  const m = meta(estado);
  const pasoCantidad = flujoTelegramCompletoEnBot(m.flujo) ? '6️⃣ ' : '';
  const extra = params.creado
    ? '\n\nℹ️ Material nuevo agregado al catálogo de la obra.'
    : '';
  const sugerida = m.draft_cantidad;
  const hintSugerida =
    sugerida && Number(sugerida) > 0
      ? `\n\n🤖 Cantidad detectada: <b>${sugerida}</b> — confirme escribiendo el mismo número o indique otra.`
      : '';

  await sendTelegramMessage(
    chatId,
    `${pasoCantidad}🔢 Indique la <b>cantidad</b> de «${escHtml(params.nombre)}» (${escHtml(params.unidad)}):${extra}${hintSugerida}`,
    { parse_mode: 'HTML' },
  );
}

async function usarMaterialEnDraft(
  supabase: SupabaseClient,
  chatId: string,
  params: {
    materialId?: string;
    nombre: string;
    unidad: string;
    creado?: boolean;
  },
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, {
    draft_material_id: params.materialId,
    draft_material_nombre: params.nombre,
    draft_unidad: params.unidad,
    draft_nombre_nuevo: undefined,
    draft_category_id: undefined,
    draft_category_nombre: undefined,
  });

  if (ingresoFacturaPideCategoriaPorLinea(meta(estado).flujo)) {
    await enviarPickerCategoriaMaterialIngreso(supabase, chatId, params.nombre);
    return;
  }

  await promptCantidadMaterialDraft(supabase, chatId, params);
}

async function aplicarCategoriaMaterialDraft(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  categoryId: string,
  categoryNombre: string,
): Promise<void> {
  const m = meta(estado);
  await patchMeta(supabase, chatId, estado, {
    draft_category_id: categoryId,
    draft_category_nombre: categoryNombre,
  });

  const materialId = m.draft_material_id?.trim();
  if (materialId && flujoTelegramCompletoEnBot(m.flujo)) {
    const hoy = new Date().toISOString().slice(0, 10);
    const depositId = await resolverDepositIdDesdeUbicacion(supabase, m.ubicacion_id);
    await actualizarMaterialExistenteCompra(supabase, materialId, {
      unitPrice: 0,
      purchaseDate: hoy,
      proyectoId: estado.proyecto_id ?? undefined,
      depositId,
      categoryId,
      entidadId: m.entidad_id,
    });
  }

  const nombre = m.draft_material_nombre ?? m.draft_nombre_nuevo ?? 'Material';
  const unidad = m.draft_unidad ?? 'UND';
  await promptCantidadMaterialDraft(supabase, chatId, { nombre, unidad });
}

async function asegurarMaterialDraftIdParaCantidad(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<TelegramEstado> {
  const m = meta(estado);
  if (m.draft_material_id?.trim()) return estado;
  if (!m.draft_nombre_nuevo?.trim() || !estado.proyecto_id) return estado;

  const material = await crearOResolverMaterialObra(supabase, {
    proyectoId: estado.proyecto_id,
    nombre: m.draft_nombre_nuevo,
    unidad: m.draft_unidad ?? 'UND',
    ubicacionId: m.ubicacion_id,
    entidadId: m.entidad_id,
    categoryId: m.draft_category_id,
  });

  await patchMeta(supabase, chatId, estado, {
    draft_material_id: material.id,
    draft_material_nombre: material.nombre,
    draft_unidad: material.unidad,
    draft_nombre_nuevo: undefined,
  });
  return getTelegramEstado(supabase, chatId);
}

async function crearOResolverMaterialObra(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    nombre: string;
    unidad: string;
    ubicacionId?: string;
    entidadId?: string | null;
    categoryId?: string | null;
  },
): Promise<{ id: string; nombre: string; unidad: string; creado: boolean }> {
  const nombre = params.nombre.trim();
  const unidad = normalizarCodigoUnidad(params.unidad);
  const hoy = new Date().toISOString().slice(0, 10);
  const depositId = await resolverDepositIdDesdeUbicacion(supabase, params.ubicacionId);

  const existente = await resolverMaterialParaLineaCompra(supabase, {
    description: nombre,
    proyectoId: params.proyectoId,
  });
  if (existente) {
    await actualizarMaterialExistenteCompra(supabase, existente.id, {
      unitPrice: 0,
      purchaseDate: hoy,
      proyectoId: params.proyectoId,
      depositId,
      categoryId: params.categoryId ?? existente.category_id,
      entidadId: params.entidadId,
    });
    const { data: row } = await supabase
      .from('global_inventory')
      .select('unit')
      .eq('id', existente.id)
      .maybeSingle();
    return {
      id: existente.id,
      nombre: existente.name,
      unidad: String(row?.unit ?? unidad).trim() || unidad,
      creado: false,
    };
  }

  const id = await crearMaterialParaLineaCompra(supabase, {
    descripcion: nombre,
    unidad,
    precio_unitario: 0,
    fecha: hoy,
    proyectoId: params.proyectoId,
    depositId,
    categoryId: params.categoryId,
    entidadId: params.entidadId,
  });

  return { id, nombre, unidad, creado: true };
}

function botonAgregarMaterialNuevo(): { text: string; callback_data: string } {
  return { text: '➕ Agregar material nuevo', callback_data: `${PREFIX}mat:nuevo` };
}

async function enviarPickerUnidadMaterialNuevo(
  supabase: SupabaseClient,
  chatId: string,
  nombreMaterial: string,
): Promise<void> {
  await patchMeta(
    supabase,
    chatId,
    await getTelegramEstado(supabase, chatId),
    { paso: 'material_nuevo_unidad', draft_nombre_nuevo: nombreMaterial },
  );

  const comunes = UNIDADES_MEDIDA_DEFAULT.slice(0, 8);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < comunes.length; i += 2) {
    const par = comunes.slice(i, i + 2).map((u) => ({
      text: `${u.code} · ${u.name}`,
      callback_data: `${PREFIX}uni:${u.code}`,
    }));
    rows.push(par);
  }
  rows.push([{ text: '✏️ Otra unidad (escribir)', callback_data: `${PREFIX}uni:custom` }]);

  await sendTelegramMessage(
    chatId,
    `🧱 Material: <b>${nombreMaterial}</b>\n\nElige la <b>unidad de medida</b>:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
  );
}

async function enviarPickerMaterialIngresoManual(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  page = 0,
): Promise<void> {
  const materiales = await listarMaterialesObraRecepcion(supabase, proyectoId);

  if (!materiales.length) {
    await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), { paso: 'material' });
    await sendTelegramMessage(
      chatId,
      '🧱 <b>Sin materiales en el catálogo</b>\n\n' +
        'Puedes <b>agregar uno nuevo</b> desde aquí (nombre + unidad).',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[botonAgregarMaterialNuevo()]] } },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(materiales.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = materiales.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((m) => [
    {
      text: truncar(m.sap_code ? `${m.name} (${m.sap_code})` : m.name),
      callback_data: `${PREFIX}mat:${m.id}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}matp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}matp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}matp:${safePage + 1}` });
    buttons.push(nav);
  }

  buttons.push([botonAgregarMaterialNuevo()]);

  await sendTelegramMessage(
    chatId,
    flujoTelegramCompletoEnBot(flujoActivo(await getTelegramEstado(supabase, chatId)))
      ? '5️⃣ 🧱 <b>Elige artículo</b> del catálogo de la obra o agrega uno nuevo:'
      : '🧱 <b>Elige el material</b> de la construcción:',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function preguntarFormaIngresoLinea(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const def = formaIngresoDefaultDesdeFlujoTelegram(meta(estado).flujo);
  await patchMeta(supabase, chatId, estado, { paso: 'forma_ingreso', draft_forma_ingreso: def });

  const fila1 = FORMAS_INGRESO_RECEPCION.slice(0, 2).map((f) => ({
    text: `${f === def ? '✓ ' : ''}${ETIQUETA_FORMA_INGRESO[f]}`,
    callback_data: `${PREFIX}forma:${f}`,
  }));
  const fila2 = FORMAS_INGRESO_RECEPCION.slice(2).map((f) => ({
    text: `${f === def ? '✓ ' : ''}${ETIQUETA_FORMA_INGRESO[f]}`,
    callback_data: `${PREFIX}forma:${f}`,
  }));

  await sendTelegramMessage(
    chatId,
    `📋 <b>Forma de ingreso</b> de esta línea\n<i>(auditoría puede pedir factura o conciliar después)</i>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [fila1, fila2] } },
  );
}

async function preguntarFotoLinea(
  supabase: SupabaseClient,
  chatId: string,
  materialNombre: string,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, { paso: 'foto_linea' });
  await sendTelegramMessage(
    chatId,
    `📷 <b>Foto de soporte</b> — «${truncar(materialNombre, 40)}»\n\n` +
      'Envía una foto de la nota parcial, etiqueta o material recibido.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏭ Omitir foto', callback_data: `${PREFIX}fotoln:skip` },
            { text: '✔ Continuar sin más fotos', callback_data: `${PREFIX}fotoln:done` },
          ],
        ],
      },
    },
  );
}

async function preguntarMasLineas(supabase: SupabaseClient, chatId: string, nLineas: number): Promise<void> {
  await patchMeta(
    supabase,
    chatId,
    await getTelegramEstado(supabase, chatId),
    { paso: 'mas_lineas' },
  );
  await sendTelegramMessage(
    chatId,
    `✅ Material agregado (${nLineas} línea(s) en total).\n\n7️⃣ ¿Agregar <b>más artículos</b>?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Agregar otro material', callback_data: `${PREFIX}mas:si` },
            { text: '✔ Continuar', callback_data: `${PREFIX}mas:no` },
          ],
        ],
      },
    },
  );
}

async function preguntarFotoOpcional(supabase: SupabaseClient, chatId: string): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, { paso: 'foto' });
  const f = flujoActivo(estado);
  const tituloFoto =
    flujoTelegramCompletoEnBot(f)
      ? f === FLUJO_NOTA_ENTREGA
        ? '8️⃣ 📷 <b>Fotos de la nota de entrega</b> (opcional)'
        : f === FLUJO_EMERGENCIA
          ? '8️⃣ 📷 <b>Soporte fotográfico</b> (opcional, sin nota)'
          : '8️⃣ 📷 <b>Soporte fotográfico</b> (opcional)'
      : '📷 <b>Soporte fotográfico</b> (opcional)';
  await sendTelegramMessage(
    chatId,
    `${tituloFoto}\n\nEnvía una o varias fotos del documento o del material recibido.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Listo con fotos', callback_data: `${PREFIX}foto:done` },
            { text: '⏭ Omitir fotos', callback_data: `${PREFIX}foto:skip` },
          ],
        ],
      },
    },
  );
}

function resumenLineas(lineas: LineaIngresoManualDraft[]): string {
  return lineas
    .map(
      (l, i) =>
        `${i + 1}. ${l.material_nombre}` +
        (l.category_nombre ? ` [${l.category_nombre}]` : '') +
        ` × ${l.cantidad} ${l.unidad} · ${ETIQUETA_FORMA_INGRESO[l.forma_ingreso]}` +
        (l.soporte_storage_path ? ' 📷' : ''),
    )
    .join('\n');
}

async function enviarConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  const lineas = m.lineas ?? [];
  await patchMeta(supabase, chatId, estado, { paso: 'confirmar' });

  const f = m.flujo;
  const tituloConfirm =
    f === FLUJO_EMERGENCIA ? '📋 <b>Registrar ingreso sin nota</b>\n'
    : f === FLUJO_NOTA_ENTREGA ? '📋 <b>Registrar nota de entrega</b>\n'
    : f === FLUJO_INGRESO_FACTURA_MANUAL ? '📋 <b>Registrar ingreso de factura</b>\n'
    : f === FLUJO_INGRESO_MANUAL ? '📋 <b>Confirmar ingreso sin nota</b>\n'
    : '📋 <b>Confirmar ingreso manual</b>\n';
  const etiquetaDoc =
    f === FLUJO_INGRESO_FACTURA_MANUAL ? 'Nº factura'
    : f === FLUJO_NOTA_ENTREGA ? 'Nota de entrega'
    : f === FLUJO_EMERGENCIA ? 'Referencia'
    : f === FLUJO_INGRESO_MANUAL ? 'Referencia'
    : 'Factura/nota';
  const nFotosLinea = lineas.filter((l) => l.soporte_storage_path).length;
  const stockHint = flujoTelegramCompletoEnBot(f)
    ? '\n\n<i>Al confirmar se registra en <b>almacén</b> (stock) y en <b>contabilidad provisional</b> (conciliación fiscal posterior).</i>'
    : '\n\n<i>Al confirmar se suma el stock en el almacén elegido.</i>';
  const texto =
    tituloConfirm +
    '\n' +
    (m.entidad_nombre ? `🏢 Entidad: ${m.entidad_nombre}\n` : '') +
    `🏭 Almacén: ${m.ubicacion_nombre ?? '—'}\n` +
    `🏢 Proveedor: ${m.proveedor_nombre ?? '—'}\n` +
    `📄 ${etiquetaDoc}: ${m.num_doc ?? 'S/N'}\n\n` +
    resumenLineas(lineas) +
    (m.observaciones?.trim() ? `\n\n📝 ${m.observaciones.trim()}` : '') +
    (nFotosLinea > 0 ? `\n\n📷 ${nFotosLinea} línea(s) con foto de soporte` : '') +
    stockHint;

  const textoBotonConfirmar = flujoTelegramCompletoEnBot(f)
    ? '✅ Registrar ingreso'
    : '✅ Confirmar ingreso';
  const token = m.recepcion_campo_token?.trim();
  const vista = vistaDesdeFlujoTelegram(f);
  const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
    [{ text: textoBotonConfirmar, callback_data: `${PREFIX}conf:ok` }],
  ];
  if (token && vista && !flujoTelegramCompletoEnBot(f)) {
    keyboard.push([
      { text: '🌐 Completar en app', url: urlRecepcionCampoBorrador(token, vista) },
    ]);
  }

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function finalizarLineaDraft(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  if (!m.draft_material_id || !m.draft_cantidad || !m.draft_material_nombre) {
    await sendTelegramMessage(chatId, '❌ Línea incompleta.', { parse_mode: 'HTML' });
    return;
  }

  const linea: LineaIngresoManualDraft = {
    material_id: m.draft_material_id,
    material_nombre: m.draft_material_nombre,
    unidad: m.draft_unidad ?? 'UND',
    cantidad: Number(m.draft_cantidad),
    forma_ingreso: m.draft_forma_ingreso ?? formaIngresoDefaultDesdeFlujoTelegram(m.flujo),
    ...(m.draft_category_id
      ? {
          category_id: m.draft_category_id,
          category_nombre: m.draft_category_nombre,
        }
      : {}),
    ...(m.draft_soporte_storage_path
      ? {
          soporte_storage_path: m.draft_soporte_storage_path,
          soporte_file_name: m.draft_soporte_file_name,
          soporte_mime_type: m.draft_soporte_mime_type,
        }
      : {}),
  };

  const lineas = [...(m.lineas ?? []), linea];
  await patchMeta(supabase, chatId, estado, {
    paso: 'mas_lineas',
    lineas,
    draft_material_id: undefined,
    draft_material_nombre: undefined,
    draft_unidad: undefined,
    draft_cantidad: undefined,
    draft_forma_ingreso: undefined,
    draft_category_id: undefined,
    draft_category_nombre: undefined,
    draft_soporte_storage_path: undefined,
    draft_soporte_file_name: undefined,
    draft_soporte_mime_type: undefined,
  });

  const fresh = await getTelegramEstado(supabase, chatId);
  const pendientesOcr = meta(fresh).ocr_lineas_pendientes ?? [];
  if (pendientesOcr.length > 0) {
    await iniciarSiguienteLineaOcrPendiente(supabase, chatId, fresh);
    return;
  }
  await preguntarMasLineas(supabase, chatId, lineas.length);
}

async function registrarIngresoManual(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    ubicacionId: string;
    proveedorNombre: string;
    proveedorId?: string | null;
    numDoc: string;
    lineas: LineaIngresoManualDraft[];
    origenLabel: string;
    tipoRecepcion: 'nota_entrega' | 'emergencia' | 'factura_canal';
    observaciones?: string;
    soporteStoragePath?: string;
    soporteFileName?: string;
    soporteMimeType?: string;
    fotosCount?: number;
    telegramUserId?: string;
    procuraId?: string | null;
  },
): Promise<{ ok: true; recepcionId: string } | { ok: false; error: string }> {
  const lineasRpc: LineaRecepcionCampoInput[] = params.lineas.map((l) => ({
    material_id: l.material_id,
    cantidad: Number(l.cantidad),
    unidad: l.unidad,
    descripcion: l.material_nombre,
    observaciones: `Origen: ${params.origenLabel}`,
    forma_ingreso: l.forma_ingreso,
    soporte_storage_path: l.soporte_storage_path ?? null,
    soporte_file_name: l.soporte_file_name ?? null,
    soporte_mime_type: l.soporte_mime_type ?? null,
  }));

  const { data: recepcionId, error: rpcErr } = await supabase.rpc('ci_registrar_ingreso_manual_campo', {
    p_proyecto_id: params.proyectoId,
    p_ubicacion_id: params.ubicacionId,
    p_proveedor_id: params.proveedorId?.trim() || null,
    p_tipo: params.tipoRecepcion,
    p_num_doc: params.numDoc.trim() || 'S/N',
    p_lineas: lineasRpc,
    p_usuario_id: null,
    p_procura_id: params.procuraId?.trim() || null,
  } as never);

  if (rpcErr) {
    return { ok: false, error: rpcErr.message ?? 'Error al registrar ingreso' };
  }

  const id = String(recepcionId ?? '');
  if (!id) {
    return { ok: false, error: 'No se obtuvo ID de recepción.' };
  }

  const obsParts = [`Origen: ${params.origenLabel}`];
  if (params.fotosCount && params.fotosCount > 1) {
    obsParts.push(`Soporte fotográfico: ${params.fotosCount} archivos`);
  }
  if (params.observaciones?.trim()) obsParts.push(params.observaciones.trim());
  if (params.telegramUserId) obsParts.push(`Telegram user: ${params.telegramUserId}`);

  const patch: Record<string, unknown> = {
    proveedor_nombre: params.proveedorNombre.trim(),
    observaciones: obsParts.join('\n'),
  };
  if (params.soporteStoragePath?.trim()) {
    patch.soporte_storage_path = params.soporteStoragePath.trim();
    patch.soporte_file_name = params.soporteFileName?.trim() || null;
    patch.soporte_mime_type = params.soporteMimeType?.trim() || null;
  }

  await supabase.from('ci_recepciones_campo').update(patch as never).eq('id', id);

  await actualizarProcuraDesdeRecepcionCampo(supabase, {
    recepcionId: id,
    procuraId: params.procuraId?.trim() || null,
  }).catch((e) => {
    console.warn('[ingresoManualTelegram] procura recepción', e);
  });

  return { ok: true, recepcionId: id };
}

export async function manejarCallbackIngresoManual(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!params.data.startsWith(PREFIX)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoIngresoManual(estado)) return false;

  const proyectoId = estado.proyecto_id;
  if (!proyectoId) {
    await answerCallbackQuery(params.callbackId, 'Elige la obra primero', true);
    return true;
  }

  const m = meta(estado);
  const data = params.data.slice(PREFIX.length);
  const nombreObra = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';

  if (data.startsWith('ubp:')) {
    const page = Number(data.slice(4));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerAlmacenIngresoManual(
      supabase,
      params.chatId,
      proyectoId,
      nombreObra,
      page,
      m.entidad_nombre,
    );
    return true;
  }

  if (data.startsWith('ub:')) {
    const ubicacionId = data.slice(3);
    const { data: ubi } = await supabase
      .from('inv_ubicaciones')
      .select('id, nombre')
      .eq('id', ubicacionId)
      .maybeSingle();
    if (!ubi) {
      await answerCallbackQuery(params.callbackId, 'Almacén no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, String(ubi.nombre));
    const flujoNorm = normalizarFlujoRecepcionCampo(m.flujo);
    if (flujoNorm && flujoNorm !== m.flujo) {
      await patchMeta(supabase, params.chatId, estado, { flujo: flujoNorm });
    }
    if (flujoUsaHandoffWebTrasAlmacen(flujoNorm ?? m.flujo)) {
      await enviarHandoffRecepcionWebTrasAlmacen(
        supabase,
        params.chatId,
        estado,
        ubicacionId,
        String(ubi.nombre),
      );
    } else {
      await patchMeta(supabase, params.chatId, estado, {
        paso: 'proveedor',
        ubicacion_id: ubicacionId,
        ubicacion_nombre: String(ubi.nombre),
        ...(flujoNorm ? { flujo: flujoNorm } : {}),
      });
      if (flujoTelegramCompletoEnBot(flujoNorm ?? m.flujo)) {
        await enviarPickerProveedorIngresoManual(
          supabase,
          params.chatId,
          proyectoId,
          String(ubi.nombre),
        );
      } else {
        await sendTelegramMessage(
          params.chatId,
          `✅ Almacén: <b>${escHtml(String(ubi.nombre))}</b>\n\n` +
            '✏️ Escribe el <b>nombre del proveedor</b>:',
          { parse_mode: 'HTML' },
        );
      }
    }
    return true;
  }

  if (data.startsWith('prvp:')) {
    const page = Number(data.slice(5));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerProveedorIngresoManual(
      supabase,
      params.chatId,
      proyectoId,
      m.ubicacion_nombre ?? 'Almacén',
      page,
    );
    return true;
  }

  if (data === 'prv:otro') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'proveedor' });
    await sendTelegramMessage(
      params.chatId,
      '3️⃣ ✏️ Escribe el <b>nombre del proveedor</b>:',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('prve:')) {
    const empId = data.slice(5);
    const { data: emp } = await supabase
      .from('empresas')
      .select('id,nombre')
      .eq('id', empId)
      .maybeSingle();
    if (!emp?.nombre) {
      await answerCallbackQuery(params.callbackId, 'Proveedor no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(String(emp.nombre), 40));
    await avanzarTrasProveedor(supabase, params.chatId, estado, {
      proveedorNombre: String(emp.nombre).trim(),
      proveedorId: String(emp.id),
      telegramUserId: m.telegram_user_id,
      telegramUsername: m.telegram_username,
    });
    return true;
  }

  if (data.startsWith('prvk:')) {
    const key = data.slice(5);
    const proveedores = await listarProveedoresSugeridosIngreso(supabase, proyectoId);
    const hit = proveedores.find((p) => p.key === key);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Proveedor no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(hit.nombre, 40));
    await avanzarTrasProveedor(supabase, params.chatId, estado, {
      proveedorNombre: hit.nombre,
      proveedorId: hit.empresasId,
      telegramUserId: m.telegram_user_id,
      telegramUsername: m.telegram_username,
    });
    return true;
  }

  if (data.startsWith('matp:')) {
    const page = Number(data.slice(5));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerMaterialIngresoManual(supabase, params.chatId, proyectoId, page);
    return true;
  }

  if (data === 'mat:nuevo') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'material_nuevo' });
    await sendTelegramMessage(
      params.chatId,
      flujoTelegramCompletoEnBot(m.flujo)
        ? '5️⃣ ✏️ Escribe el <b>nombre del material nuevo</b> (mín. 2 caracteres).'
        : '✏️ Escribe el <b>nombre del material</b> (mín. 2 caracteres).',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('cat:')) {
    const categoryId = data.slice(4);
    const categorias = await asegurarCategoriasCompraSugeridas(supabase);
    const hitCat = buscarCategoriaPorId(categorias, categoryId);
    if (!hitCat) {
      await answerCallbackQuery(params.callbackId, 'Categoría no válida', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(hitCat.name, 40));
    await aplicarCategoriaMaterialDraft(supabase, params.chatId, estado, hitCat.id, hitCat.name);
    return true;
  }

  if (data.startsWith('uni:')) {
    const codigoUnidad = data.slice(4);
    if (codigoUnidad === 'custom') {
      await answerCallbackQuery(params.callbackId);
      await patchMeta(supabase, params.chatId, estado, { paso: 'material_nuevo_unidad' });
      await sendTelegramMessage(
        params.chatId,
        '✏️ Escribe la unidad (ej. <code>UND</code>, <code>M2</code>, <code>SAC</code>):',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const nombreNuevo = m.draft_nombre_nuevo?.trim();
    if (!nombreNuevo) {
      await answerCallbackQuery(params.callbackId, 'Escribe el material primero', true);
      return true;
    }

    await answerCallbackQuery(params.callbackId, codigoUnidad);
    if (ingresoFacturaPideCategoriaPorLinea(m.flujo)) {
      await patchMeta(supabase, params.chatId, estado, { draft_unidad: codigoUnidad });
      await enviarPickerCategoriaMaterialIngreso(supabase, params.chatId, nombreNuevo);
      return true;
    }
    try {
      const material = await crearOResolverMaterialObra(supabase, {
        proyectoId,
        nombre: nombreNuevo,
        unidad: codigoUnidad,
        ubicacionId: m.ubicacion_id,
        entidadId: m.entidad_id,
      });
      await usarMaterialEnDraft(supabase, params.chatId, {
        materialId: material.id,
        nombre: material.nombre,
        unidad: material.unidad,
        creado: material.creado,
      });
    } catch (err) {
      await sendTelegramMessage(
        params.chatId,
        `❌ ${err instanceof Error ? err.message : 'No se pudo crear el material'}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  if (data.startsWith('mat:')) {
    const materialId = data.slice(4);
    const materiales = await listarMaterialesObraRecepcion(supabase, proyectoId);
    const hit = materiales.find((x) => x.id === materialId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Material no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(hit.name, 40));
    await usarMaterialEnDraft(supabase, params.chatId, {
      materialId: hit.id,
      nombre: hit.name,
      unidad: hit.unit,
    });
    return true;
  }

  if (data === 'mas:si') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'material' });
    await enviarPickerMaterialIngresoManual(supabase, params.chatId, proyectoId);
    return true;
  }

  if (data === 'mas:no') {
    await answerCallbackQuery(params.callbackId);
    const lineas = m.lineas ?? [];
    if (!lineas.length) {
      await sendTelegramMessage(
        params.chatId,
        '⚠️ Agregue al menos un material antes de continuar.',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    if (flujoTelegramCompletoEnBot(m.flujo)) {
      await preguntarFotoOpcional(supabase, params.chatId);
    } else {
      await patchMeta(supabase, params.chatId, estado, { paso: 'observacion' });
      await sendTelegramMessage(
        params.chatId,
        '📝 Escriba <b>observaciones</b> (opcional; envíe <code>-</code> para omitir):',
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  if (data.startsWith('forma:')) {
    const formaRaw = data.slice(6);
    if (!esFormaIngresoRecepcion(formaRaw)) {
      await answerCallbackQuery(params.callbackId, 'Forma no válida', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, ETIQUETA_FORMA_INGRESO[formaRaw].slice(0, 40));
    await patchMeta(supabase, params.chatId, estado, { draft_forma_ingreso: formaRaw });
    const nombreMat = m.draft_material_nombre ?? 'Material';
    await preguntarFotoLinea(supabase, params.chatId, nombreMat);
    return true;
  }

  if (data === 'fotoln:skip' || data === 'fotoln:done') {
    await answerCallbackQuery(params.callbackId);
    await finalizarLineaDraft(supabase, params.chatId, await getTelegramEstado(supabase, params.chatId));
    return true;
  }

  if (data === 'foto:skip' || data === 'foto:done') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'observacion' });
    const obsPrompt = flujoTelegramCompletoEnBot(m.flujo)
      ? '9️⃣ 📝 Escriba <b>observaciones</b> (opcional; envíe <code>-</code> para omitir):'
      : '📝 Escriba <b>observaciones</b> (opcional; envíe <code>-</code> para omitir):';
    await sendTelegramMessage(params.chatId, obsPrompt, { parse_mode: 'HTML' });
    return true;
  }

  if (data === 'conf:ok') {
    await answerCallbackQuery(params.callbackId, 'Procesando…');
    const fresh = await getTelegramEstado(supabase, params.chatId);
    const fm = meta(fresh);

    if (fm.recepcion_campo_registrada_id?.trim()) {
      await sendTelegramMessage(
        params.chatId,
        '✅ Este ingreso ya fue registrado. No repita la operación.\n\n' +
          `ID: <code>${fm.recepcion_campo_registrada_id.slice(0, 8)}…</code>`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const lineas = fm.lineas ?? [];
    if (!lineas.length || !fm.ubicacion_id || !fm.proveedor_nombre) {
      await sendTelegramMessage(params.chatId, '❌ Ingreso incompleto.', { parse_mode: 'HTML' });
      return true;
    }

    const lineasInvalidas = lineas.filter(
      (l) => !l.material_id?.trim() || !Number.isFinite(Number(l.cantidad)) || Number(l.cantidad) <= 0,
    );
    if (lineasInvalidas.length) {
      await sendTelegramMessage(
        params.chatId,
        '❌ Hay materiales sin cantidad válida. Agregue de nuevo las líneas con cantidad mayor a cero.',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const fotos = fm.fotos_storage_paths ?? [];
    const resultado = await registrarIngresoManual(supabase, {
      proyectoId,
      ubicacionId: fm.ubicacion_id,
      proveedorNombre: fm.proveedor_nombre,
      proveedorId: fm.proveedor_id,
      numDoc: fm.num_doc ?? 'S/N',
      lineas,
      origenLabel: etiquetaOrigen(fm.flujo),
      tipoRecepcion: tipoRpcRecepcion(fm.flujo),
      observaciones: fm.observaciones,
      soporteStoragePath: fm.soporte_storage_path ?? fotos[0],
      soporteFileName: fm.soporte_file_name,
      soporteMimeType: fm.soporte_mime_type,
      fotosCount: fotos.length || (fm.soporte_storage_path ? 1 : 0),
      telegramUserId: fm.telegram_user_id,
    });

    if (!resultado.ok) {
      await sendTelegramMessage(params.chatId, `❌ ${resultado.error}`, { parse_mode: 'HTML' });
      return true;
    }

    let avisoContabilidad = '';
    let contaOk = false;
    const lineasConta = lineas.map((l) => ({
      material_id: l.material_id,
      material_nombre: l.material_nombre,
      unidad: l.unidad,
      cantidad: Number(l.cantidad),
    }));
    const conta = await sincronizarContabilidadDesdeRecepcionCampo(supabase, {
      recepcionCampoId: resultado.recepcionId,
      proyectoId,
      ubicacionId: fm.ubicacion_id,
      entidadId: fm.entidad_id,
      proveedorNombre: fm.proveedor_nombre,
      numDoc: fm.num_doc ?? 'S/N',
      tipoRecepcion: tipoRpcRecepcion(fm.flujo),
      lineas: lineasConta,
      soporteStoragePath: fm.soporte_storage_path ?? fotos[0],
    });
    contaOk = conta.ok;
    if (!conta.ok) {
      avisoContabilidad =
        `\n\n⚠️ Stock registrado, pero no se reflejó en compras: ${conta.error}`;
    } else if (conta.provisional) {
      avisoContabilidad =
        '\n\n📋 Contabilidad provisional registrada. Concilie con la factura fiscal cuando llegue.';
    } else {
      avisoContabilidad =
        '\n\n📋 Contabilidad provisional registrada (conciliación fiscal posterior).';
    }

    const borradorToken = fm.recepcion_campo_token?.trim();
    if (borradorToken) {
      try {
        await marcarBorradorRecepcionConsumido(supabase, borradorToken, resultado.recepcionId);
      } catch {
        /* no bloquear éxito */
      }
    }

    await setTelegramContexto(supabase, params.chatId, {
      contexto: 'menu',
      pending_factura_id: null,
      metadata: {},
    });

    const suffixAlmacenConta = contaOk ? ' (almacén + contabilidad)' : ' (solo almacén)';
    const tituloExito =
      fm.flujo === FLUJO_EMERGENCIA
        ? `✅ <b>Ingreso sin nota registrado</b>${suffixAlmacenConta}\n\n`
        : fm.flujo === FLUJO_NOTA_ENTREGA
          ? `✅ <b>Nota de entrega registrada</b>${suffixAlmacenConta}\n\n`
          : fm.flujo === FLUJO_INGRESO_FACTURA_MANUAL
            ? `✅ <b>Factura ingresada</b>${suffixAlmacenConta}\n\n`
            : `✅ <b>Ingreso a almacén registrado</b>${suffixAlmacenConta}\n\n`;
    await sendTelegramMessage(
      params.chatId,
      tituloExito +
        `${fm.proveedor_nombre ?? 'Proveedor'} · #${fm.num_doc ?? 'S/N'}` +
        avisoContabilidad,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarTextoIngresoManual(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
  userId?: string,
  username?: string | null,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoIngresoManual(estado)) return false;

  const m = meta(estado);
  const paso = m.paso;
  const trimmed = texto.trim();

  if (paso === 'web') {
    const link = urlRecepcionDesdeMetadata(m);
    await sendTelegramMessage(
      chatId,
      '🌐 Complete el ingreso en la app web. Obra y almacén ya están precargados.',
      {
        parse_mode: 'HTML',
        ...(link
          ? { reply_markup: { inline_keyboard: [[{ text: '🌐 Abrir recepción', url: link }]] } }
          : {}),
      },
    );
    return true;
  }

  if (paso === 'proveedor') {
    if (trimmed.length < MIN_PROVEEDOR) {
      await sendTelegramMessage(
        chatId,
        `✏️ El proveedor es obligatorio (mín. ${MIN_PROVEEDOR} caracteres).`,
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await avanzarTrasProveedor(supabase, chatId, estado, {
      proveedorNombre: trimmed,
      telegramUserId: userId,
      telegramUsername: username ?? null,
    });
    return true;
  }

  if (paso === 'num_doc') {
    const numDoc = trimmed || 'S/N';
    await continuarTrasNumDocIngreso(supabase, chatId, estado, numDoc);
    return true;
  }

  if (paso === 'ocr_factura') {
    const numDoc = trimmed || 'S/N';
    await continuarTrasNumDocIngreso(supabase, chatId, estado, numDoc);
    return true;
  }

  if (paso === 'material_nuevo') {
    if (trimmed.length < 2) {
      await sendTelegramMessage(
        chatId,
        'Nombre muy corto. Escribe al menos 2 caracteres (ej. <code>Cemento gris</code>).',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    if (!estado.proyecto_id) return true;
    await enviarPickerUnidadMaterialNuevo(supabase, chatId, trimmed);
    return true;
  }

  if (paso === 'material_nuevo_unidad') {
    const unidad = normalizarCodigoUnidad(trimmed);
    const nombreNuevo = meta(estado).draft_nombre_nuevo?.trim();
    if (!nombreNuevo || !estado.proyecto_id) {
      await sendTelegramMessage(chatId, '❌ Reinicia el material. Elige de nuevo «Agregar material nuevo».', {
        parse_mode: 'HTML',
      });
      return true;
    }
    if (ingresoFacturaPideCategoriaPorLinea(meta(estado).flujo)) {
      await patchMeta(supabase, chatId, estado, { draft_unidad: unidad });
      await enviarPickerCategoriaMaterialIngreso(supabase, chatId, nombreNuevo);
      return true;
    }
    try {
      const material = await crearOResolverMaterialObra(supabase, {
        proyectoId: estado.proyecto_id,
        nombre: nombreNuevo,
        unidad,
        ubicacionId: meta(estado).ubicacion_id,
        entidadId: meta(estado).entidad_id,
      });
      await usarMaterialEnDraft(supabase, chatId, {
        materialId: material.id,
        nombre: material.nombre,
        unidad: material.unidad,
        creado: material.creado,
      });
    } catch (err) {
      await sendTelegramMessage(
        chatId,
        `❌ ${err instanceof Error ? err.message : 'No se pudo crear el material'}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  if (paso === 'categoria') {
    await sendTelegramMessage(
      chatId,
      'Elige la <b>categoría del material</b> con los botones del mensaje anterior.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'cantidad') {
    const qty = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      await sendTelegramMessage(chatId, 'Cantidad inválida. Escriba un número mayor a cero.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    await patchMeta(supabase, chatId, estado, { draft_cantidad: qty });
    let estadoQty = await getTelegramEstado(supabase, chatId);
    const flujoQty = flujoActivo(estadoQty);
    if (flujoTelegramCompletoEnBot(flujoQty)) {
      estadoQty = await asegurarMaterialDraftIdParaCantidad(supabase, chatId, estadoQty);
      await patchMeta(supabase, chatId, estadoQty, {
        draft_cantidad: qty,
        draft_forma_ingreso: formaIngresoDefaultDesdeFlujoTelegram(flujoQty),
      });
      await finalizarLineaDraft(
        supabase,
        chatId,
        await getTelegramEstado(supabase, chatId),
      );
    } else {
      await preguntarFormaIngresoLinea(supabase, chatId, estadoQty);
    }
    return true;
  }

  if (paso === 'observacion') {
    const obs = trimmed === '-' ? '' : trimmed;
    await patchMeta(supabase, chatId, estado, {
      paso: 'confirmar',
      observaciones: obs,
      telegram_user_id: userId ?? meta(estado).telegram_user_id,
      telegram_username: username ?? meta(estado).telegram_username,
    });
    await enviarConfirmacion(supabase, chatId, await getTelegramEstado(supabase, chatId));
    return true;
  }

  if (paso === 'foto_linea') {
    await sendTelegramMessage(
      chatId,
      'Envíe la foto de esta línea o pulse <b>Omitir foto</b> en el mensaje anterior.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'forma_ingreso') {
    await sendTelegramMessage(chatId, 'Elija la <b>forma de ingreso</b> con los botones de arriba.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (paso === 'foto') {
    await sendTelegramMessage(
      chatId,
      'Envíe la foto o pulse <b>Omitir foto</b> en el mensaje anterior.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarFotoIngresoManual(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  username?: string | null;
  buffer: Buffer;
  mimeType: string;
  ext: string;
  fileName?: string;
  caption?: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoIngresoManual(estado)) return false;

  const paso = meta(estado).paso;
  if (paso === 'ocr_factura') {
    if (!estado.proyecto_id) return false;
    try {
      const m0 = meta(estado);
      const storagePath = `recepciones-campo/telegram-ocr-${params.chatId}/${Date.now()}.${params.ext}`;
      const { error: upErr } = await params.supabase.storage
        .from(PROCUREMENT_DOCUMENTS_BUCKET)
        .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });
      if (upErr) throw upErr;

      const { data: extracted } = await extractPurchaseInvoiceFromFile({
        buffer: params.buffer,
        mimeType: params.mimeType,
        fileName: params.fileName ?? `factura.${params.ext}`,
      });

      const proveedorOcr = String(extracted.supplier_name ?? '').trim();
      const numDoc = String(extracted.invoice_number ?? 'S/N').trim() || 'S/N';
      const lineasOcr: OcrLineaPendienteIngreso[] = [];
      let sinResolver = 0;

      for (const item of extracted.items ?? []) {
        const descripcion = String(item.description ?? '').trim();
        if (!descripcion) continue;
        const cantidad = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
        const unidad = normalizarCodigoUnidad(String(item.unit ?? 'UND'));
        const resuelto = await resolverMaterialParaLineaCompra(params.supabase, {
          description: descripcion,
          item_code: String(item.item_code ?? '').trim() || undefined,
          proyectoId: estado.proyecto_id,
        });
        if (!resuelto?.id) {
          sinResolver += 1;
          continue;
        }
        lineasOcr.push({
          material_id: resuelto.id,
          material_nombre: resuelto.name || descripcion,
          unidad,
          cantidad,
        });
      }

      if (!lineasOcr.length) {
        await sendTelegramMessage(
          params.chatId,
          '❌ No pude vincular materiales del OCR al catálogo de la obra.\n\n' +
            'Escriba el número de factura para cargar artículos manualmente, o use ingreso manual de factura.',
          { parse_mode: 'HTML' },
        );
        return true;
      }

      const avisoSinResolver =
        sinResolver > 0
          ? `${sinResolver} artículo(s) de la factura no se vincularon al catálogo; podrá agregarlos manualmente después.`
          : undefined;
      const fotosPrevias = m0.fotos_storage_paths ?? [];

      await patchMeta(params.supabase, params.chatId, estado, {
        num_doc: numDoc,
        ...(m0.proveedor_nombre?.trim()
          ? {}
          : proveedorOcr
            ? { proveedor_nombre: proveedorOcr }
            : {}),
        ocr_lineas_pendientes: lineasOcr,
        ocr_aviso_sin_resolver: avisoSinResolver,
        soporte_storage_path: storagePath,
        soporte_file_name: params.fileName ?? `factura-ocr.${params.ext}`,
        soporte_mime_type: params.mimeType,
        fotos_storage_paths: [...fotosPrevias, storagePath],
        lineas: m0.lineas ?? [],
        telegram_user_id: params.userId,
        telegram_username: params.username ?? null,
      });

      await sendTelegramMessage(
        params.chatId,
        `✅ <b>Factura leída por IA</b>\n\n` +
          `📄 Nº <code>${escHtml(numDoc)}</code>\n` +
          `📦 ${lineasOcr.length} artículo(s) detectado(s).\n\n` +
          '5️⃣–6️⃣ Revise <b>categoría</b> y <b>cantidad</b> de cada línea antes de continuar.',
        { parse_mode: 'HTML' },
      );

      await iniciarSiguienteLineaOcrPendiente(
        params.supabase,
        params.chatId,
        await getTelegramEstado(params.supabase, params.chatId),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error OCR';
      await sendTelegramMessage(
        params.chatId,
        `❌ No se pudo leer la factura.\n${escHtml(msg)}\n\n` +
          'Escriba el número de factura para continuar manualmente, o reintente con otra foto.',
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }
  if (paso === 'web') {
    const link = urlRecepcionDesdeMetadata(meta(estado));
    await sendTelegramMessage(
      params.chatId,
      '🌐 Suba las fotos y complete el ingreso en la app web.',
      {
        parse_mode: 'HTML',
        ...(link
          ? { reply_markup: { inline_keyboard: [[{ text: '🌐 Abrir recepción', url: link }]] } }
          : {}),
      },
    );
    return true;
  }
  if (paso === 'foto_linea') {
    if (!estado.proyecto_id) return false;

    const storagePath = `recepciones-campo/telegram-${params.chatId}/${Date.now()}.${params.ext}`;
    const { error } = await params.supabase.storage
      .from(PROCUREMENT_DOCUMENTS_BUCKET)
      .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });

    if (error) {
      await sendTelegramMessage(params.chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
      return true;
    }

    await patchMeta(params.supabase, params.chatId, estado, {
      draft_soporte_storage_path: storagePath,
      draft_soporte_file_name: params.fileName ?? `telegram-linea.${params.ext}`,
      draft_soporte_mime_type: params.mimeType,
      telegram_user_id: params.userId,
      telegram_username: params.username ?? null,
    });

    await sendTelegramMessage(params.chatId, '✅ Foto guardada para esta línea.', { parse_mode: 'HTML' });
    await finalizarLineaDraft(
      params.supabase,
      params.chatId,
      await getTelegramEstado(params.supabase, params.chatId),
    );
    return true;
  }

  if (paso !== 'foto' && paso !== 'observacion') return false;
  if (!estado.proyecto_id) return false;

  const storagePath = `recepciones-campo/telegram-${params.chatId}/${Date.now()}.${params.ext}`;
  const { error } = await params.supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });

  if (error) {
    await sendTelegramMessage(params.chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
    return true;
  }

  const fotos = [...(meta(estado).fotos_storage_paths ?? []), storagePath];
  await patchMeta(params.supabase, params.chatId, estado, {
    soporte_storage_path: meta(estado).soporte_storage_path ?? storagePath,
    soporte_file_name: params.fileName ?? `telegram-soporte.${params.ext}`,
    soporte_mime_type: params.mimeType,
    fotos_storage_paths: fotos,
    telegram_user_id: params.userId,
    telegram_username: params.username ?? null,
    paso: 'foto',
    observaciones: params.caption?.trim() || meta(estado).observaciones,
  });

  await sendTelegramMessage(
    params.chatId,
    `✅ Foto ${fotos.length} guardada.\n\nPuedes enviar más fotos o pulsar <b>Listo con fotos</b>.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Listo con fotos', callback_data: `${PREFIX}foto:done` },
            { text: '⏭ Omitir fotos', callback_data: `${PREFIX}foto:skip` },
          ],
        ],
      },
    },
  );
  return true;
}

export function esComandoIngresoManual(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return (
    t === '/ingresomanual' ||
    t === '/ingresosinnota' ||
    t === '/ingresosinnotas' ||
    t === '/sinnota'
  );
}

/** Comandos que inician el flujo nota de entrega → stock (depositario). */
export function esComandoNotaEntregaIngreso(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return (
    t === '/nota' ||
    t === '/notaentrega' ||
    t === '/entrada' ||
    t === '/ingresonotas' ||
    t === '/ingresonota'
  );
}

/** Comandos que inician ingreso urgente sin documentos fiscales. */
export function esComandoEmergenciaIngreso(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return (
    t === '/emergencia' ||
    t === '/urgente' ||
    t === '/ingresoemergencia' ||
    t === '/emergencias'
  );
}
