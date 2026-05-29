import type { SupabaseClient } from '@supabase/supabase-js';
import {
  downloadTelegramFile,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import {
  mensajeInicioEntradaSalida,
  mensajeObraListaEntradaSalida,
  mensajePedirObservacion,
  mensajeRegistroCompleto,
} from '@/lib/telegram/mensajesEntradaSalida';
import {
  enviarPickerProyectosTelegram,
  nombreProyectoTelegram,
} from '@/lib/telegram/proyectoPicker';
import type { TelegramPhotoSize } from '@/lib/telegram/aguaRegistro';
import { fileIdFotoTelegramMaxResolucion } from '@/lib/telegram/aguaRegistro';
import { extractPurchaseInvoiceFromFile } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import {
  ejecutarDespachoTelegramSalida,
  matchearLineasOcrSalida,
  type LineaOcrSalida,
} from '@/lib/almacen/despachoTelegramSalida';
import { enviarPickerOrigenSalidaTelegram, hayAlmacenesOrigenSalida } from '@/lib/telegram/salidaOrigenPicker';

const BUCKET = 'ci-proyectos-media';
const MIN_OBS = 3;

export type TipoMovimientoObra = 'entrada' | 'salida';

export type PasoEntradaSalida =
  | 'capitulo'
  | 'nuevo_capitulo'
  | 'foto'
  | 'observacion'
  | 'origen';

export type MetadataEntradaSalida = {
  paso?: PasoEntradaSalida;
  tipo_movimiento?: TipoMovimientoObra;
  capitulo_id?: string;
  capitulo_nombre?: string;
  foto_storage_path?: string;
  foto_url?: string;
  telegram_user_id?: string;
  telegram_username?: string | null;
  lineas_ocr?: LineaOcrSalida[];
  ocr_ok?: boolean;
  observacion_text?: string;
  nombre_obra?: string;
  n_materiales_match?: number;
  origen_ubicacion_id?: string;
};

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

function meta(estado: TelegramEstado): MetadataEntradaSalida {
  return (estado.metadata ?? {}) as MetadataEntradaSalida;
}

function contextoEsSalidaObra(ctx: string): ctx is 'salida_obra' {
  return ctx === 'salida_obra';
}

export function tipoDesdeContexto(ctx: string): TipoMovimientoObra | null {
  if (ctx === 'salida_obra') return 'salida';
  return null;
}

function tablaMovimientosFalta(error: { message?: string; code?: string } | null): boolean {
  const msg = error?.message ?? '';
  return error?.code === '42P01' || msg.includes('does not exist');
}

function mensajeMigracion(): string {
  return (
    '⚠️ Tabla de entradas/salidas no instalada. ' +
    'Ejecuta <code>npm run db:apply-lulo-telegram</code> (migración 174).'
  );
}

export async function manejarComandoSalidaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: null,
    metadata: { paso: 'foto', tipo_movimiento: 'salida' },
  });
  await sendTelegramMessage(chatId, mensajeInicioEntradaSalida('salida'), {
    parse_mode: 'HTML',
  });
  await sendTelegramMessage(
    chatId,
    'Tras elegir la obra podrás seleccionar el <b>capítulo</b> presupuestario (o crear uno nuevo).\n' +
      'Si la foto permite leer materiales, se descontará stock del almacén que elijas.',
    { parse_mode: 'HTML' },
  );
  await enviarPickerProyectosTelegram(supabase, chatId, 'salida_obra');
}

/** Tras elegir obra en el picker (entrada/salida). */
export async function prepararEntradaSalidaTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  tipo: TipoMovimientoObra,
): Promise<void> {
  const ctx = tipo === 'entrada' ? 'entrada_obra' : 'salida_obra';
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await setTelegramContexto(supabase, chatId, {
    contexto: ctx,
    proyecto_id: proyectoId,
    metadata: { paso: 'foto', tipo_movimiento: tipo },
  });
  await sendTelegramMessage(chatId, mensajeObraListaEntradaSalida(tipo, nombre), {
    parse_mode: 'HTML',
  });
}

async function subirFotoMovimiento(
  supabase: SupabaseClient,
  proyectoId: string,
  tipo: TipoMovimientoObra,
  buffer: Buffer,
  mimeType: string,
  ext: string,
): Promise<{ storagePath: string; publicUrl: string | null }> {
  const storagePath = `telegram-movimientos/${proyectoId}/${tipo}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl ?? null };
}

async function guardarMovimiento(params: {
  supabase: SupabaseClient;
  proyectoId: string;
  tipo: TipoMovimientoObra;
  storagePath: string;
  publicUrl: string | null;
  observacion: string;
  chatId: string;
  userId: string;
  username?: string | null;
  capituloId?: string | null;
  capituloNombre?: string | null;
  transferenciaId?: string | null;
  stockAplicado?: boolean;
  lineasExtraidas?: LineaOcrSalida[] | null;
}): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, unknown> = {
    proyecto_id: params.proyectoId,
    tipo: params.tipo,
    foto_storage_path: params.storagePath,
    foto_url: params.publicUrl,
    observacion: params.observacion.trim(),
    chat_id: params.chatId,
    telegram_user_id: params.userId,
    telegram_username: params.username ?? null,
    stock_aplicado: params.stockAplicado ?? false,
  };
  if (params.capituloId) {
    row.capitulo_id = params.capituloId;
    row.capitulo_nombre = params.capituloNombre?.trim() || null;
  }
  if (params.transferenciaId) {
    row.transferencia_id = params.transferenciaId;
  }
  if (params.lineasExtraidas?.length) {
    row.lineas_extraidas = params.lineasExtraidas;
  }

  const { error } = await params.supabase.from('ci_obra_movimientos_material').insert(row);
  if (error) {
    if (tablaMovimientosFalta(error)) return { ok: false, error: 'migration' };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

function lineasConMatch(lineas?: LineaOcrSalida[]): LineaOcrSalida[] {
  return (lineas ?? []).filter((l) => l.material_id && l.match_ok);
}

function resumenLineasOcr(lineas: LineaOcrSalida[]): string {
  const matched = lineasConMatch(lineas);
  if (!matched.length) {
    return 'ℹ️ No identifiqué materiales en inventario. Se guardará solo el registro fotográfico.';
  }
  const detalle = matched
    .slice(0, 5)
    .map((l) => `• ${l.material_nombre ?? l.description} × ${l.quantity}`)
    .join('\n');
  const extra = matched.length > 5 ? `\n… y ${matched.length - 5} más` : '';
  return `🔍 Detecté <b>${matched.length}</b> material(es) en inventario:\n${detalle}${extra}`;
}

async function continuarTrasObservacionSalida(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  observacion: string,
): Promise<void> {
  const metaState = meta(estado);
  const proyectoId = estado.proyecto_id;
  if (!proyectoId) return;

  const matched = lineasConMatch(metaState.lineas_ocr);
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';

  if (!matched.length || !metaState.capitulo_id) {
    await finalizarMovimientoFotografico(supabase, chatId, estado, observacion, {
      avisoStock: !matched.length ? 'sin_ocr' : 'sin_capitulo',
    });
    return;
  }

  const hayAlmacenes = await hayAlmacenesOrigenSalida(supabase, proyectoId);
  if (!hayAlmacenes) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay almacenes centrales o móviles configurados.',
      { parse_mode: 'HTML' },
    );
    await finalizarMovimientoFotografico(supabase, chatId, estado, observacion, {
      avisoStock: 'fallo_transferencia',
      detalleError: 'sin almacenes de origen',
    });
    return;
  }

  await setTelegramContexto(supabase, chatId, {
    metadata: {
      ...metaState,
      paso: 'origen',
      observacion_text: observacion.trim(),
      nombre_obra: nombre,
      n_materiales_match: matched.length,
    },
  });

  await sendTelegramMessage(chatId, resumenLineasOcr(metaState.lineas_ocr ?? []), {
    parse_mode: 'HTML',
  });
  await enviarPickerOrigenSalidaTelegram(supabase, chatId, {
    proyectoId,
    nombreObra: nombre,
    nMateriales: matched.length,
  });
}

async function finalizarMovimientoFotografico(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  observacion: string,
  opts?: { avisoStock?: 'sin_ocr' | 'sin_capitulo' | 'fallo_transferencia'; detalleError?: string },
): Promise<void> {
  const tipo = meta(estado).tipo_movimiento ?? tipoDesdeContexto(estado.contexto);
  const proyectoId = estado.proyecto_id;
  const storagePath = meta(estado).foto_storage_path;
  const publicUrl = meta(estado).foto_url ?? null;
  const userId = meta(estado).telegram_user_id ?? chatId;
  const username = meta(estado).telegram_username ?? null;

  if (!tipo || !proyectoId || !storagePath) {
    await sendTelegramMessage(
      chatId,
      '❌ Registro incompleto. Reinicia con <code>/salida</code>.',
      { parse_mode: 'HTML' },
    );
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    return;
  }

  const guardado = await guardarMovimiento({
    supabase,
    proyectoId,
    tipo,
    storagePath,
    publicUrl,
    observacion: observacion.trim(),
    chatId,
    userId,
    username,
    capituloId: meta(estado).capitulo_id ?? null,
    capituloNombre: meta(estado).capitulo_nombre ?? null,
    stockAplicado: false,
    lineasExtraidas: meta(estado).lineas_ocr ?? null,
  });

  if (!guardado.ok) {
    await sendTelegramMessage(
      chatId,
      guardado.error === 'migration' ? mensajeMigracion() : `❌ ${guardado.error}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  const link = `${baseUrlApp()}/proyectos/modulo/${proyectoId}/control-obra`;
  const cap = meta(estado).capitulo_nombre?.trim();
  const capLine = cap ? `\n📂 Capítulo: <b>${cap}</b>` : '';

  let aviso = '';
  if (opts?.avisoStock === 'sin_ocr') {
    aviso = '\n\n⚠️ Sin descuento de stock (no se leyeron materiales del inventario).';
  } else if (opts?.avisoStock === 'sin_capitulo') {
    aviso = '\n\n⚠️ Sin descuento de stock (capítulo sin partidas).';
  } else if (opts?.avisoStock === 'fallo_transferencia') {
    aviso = `\n\n⚠️ Sin descuento de stock: ${opts.detalleError ?? 'error en transferencia'}.`;
  }

  await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
  await sendTelegramMessage(
    chatId,
    mensajeRegistroCompleto({ tipo, nombreObra: nombre, observacion: observacion.trim(), linkObra: link })
      .replace('\n\n📝', `${capLine}\n\n📝`) + aviso,
    { parse_mode: 'HTML' },
  );
}

/** Callback del picker de almacén origen en /salida. */
export async function manejarOrigenSalidaTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  origenUbicacionId: string;
}): Promise<void> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  const metaState = meta(estado);
  const proyectoId = estado.proyecto_id;
  const observacion = metaState.observacion_text?.trim() ?? '';
  const storagePath = metaState.foto_storage_path;
  const capituloId = metaState.capitulo_id;

  if (!proyectoId || !storagePath || !capituloId || observacion.length < MIN_OBS) {
    await sendTelegramMessage(params.chatId, '❌ Datos incompletos. Reinicia con <code>/salida</code>.', {
      parse_mode: 'HTML',
    });
    await setTelegramContexto(params.supabase, params.chatId, { contexto: 'menu', metadata: {} });
    return;
  }

  const nombre = (await nombreProyectoTelegram(params.supabase, proyectoId)) ?? 'Obra';
  const lineasOcr = metaState.lineas_ocr ?? [];
  const matched = lineasConMatch(lineasOcr);

  if (!matched.length) {
    await finalizarMovimientoFotografico(params.supabase, params.chatId, estado, observacion, {
      avisoStock: 'sin_ocr',
    });
    return;
  }

  const resultado = await ejecutarDespachoTelegramSalida({
    supabase: params.supabase,
    proyectoId,
    nombreObra: nombre,
    capituloId,
    origenUbicacionId: params.origenUbicacionId,
    lineasOcr: matched,
    observacion,
  });

  if (!resultado.ok) {
    await finalizarMovimientoFotografico(params.supabase, params.chatId, estado, observacion, {
      avisoStock: 'fallo_transferencia',
      detalleError: resultado.error,
    });
    return;
  }

  const userId = metaState.telegram_user_id ?? params.chatId;
  const guardado = await guardarMovimiento({
    supabase: params.supabase,
    proyectoId,
    tipo: 'salida',
    storagePath,
    publicUrl: metaState.foto_url ?? null,
    observacion,
    chatId: params.chatId,
    userId,
    username: metaState.telegram_username ?? null,
    capituloId,
    capituloNombre: metaState.capitulo_nombre ?? null,
    transferenciaId: resultado.transferenciaId,
    stockAplicado: true,
    lineasExtraidas: lineasOcr,
  });

  if (!guardado.ok) {
    await sendTelegramMessage(
      params.chatId,
      guardado.error === 'migration' ? mensajeMigracion() : `❌ ${guardado.error}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const link = `${baseUrlApp()}/proyectos/modulo/${proyectoId}/control-obra`;
  const cap = metaState.capitulo_nombre?.trim();
  const capLine = cap ? `\n📂 Capítulo: <b>${cap}</b>` : '';

  await setTelegramContexto(params.supabase, params.chatId, { contexto: 'menu', metadata: {} });
  await sendTelegramMessage(
    params.chatId,
    mensajeRegistroCompleto({
      tipo: 'salida',
      nombreObra: nombre,
      observacion,
      linkObra: link,
    }).replace(
      '\n\n📝',
      `${capLine}\n\n📦 Transferencia <b>${resultado.codigo}</b> · ${resultado.nLineas} material(es)\n✅ Stock descontado\n\n📝`,
    ),
    { parse_mode: 'HTML' },
  );
}

async function finalizarMovimiento(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  observacion: string,
): Promise<void> {
  const tipo = meta(estado).tipo_movimiento ?? tipoDesdeContexto(estado.contexto);
  const obs = observacion.trim();

  if (obs.length < MIN_OBS) {
    await sendTelegramMessage(
      chatId,
      `✏️ La observación es muy corta (mín. ${MIN_OBS} caracteres). Describe lo visto en la foto.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (tipo === 'salida') {
    await continuarTrasObservacionSalida(supabase, chatId, estado, obs);
    return;
  }

  await finalizarMovimientoFotografico(supabase, chatId, estado, obs);
}

export type ResultadoEntradaSalida = { handled: boolean; motivo?: string };

export async function manejarFotoEntradaSalidaTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  username?: string | null;
  photo: TelegramPhotoSize[];
  caption?: string;
}): Promise<ResultadoEntradaSalida> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!contextoEsSalidaObra(estado.contexto)) {
    return { handled: false };
  }

  const tipo = meta(estado).tipo_movimiento ?? tipoDesdeContexto(estado.contexto);
  if (!tipo) return { handled: false };

  const paso = meta(estado).paso ?? 'foto';
  if (paso !== 'foto') {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Ya recibí la foto. Envía solo el texto de la <b>observación</b>.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'paso_observacion' };
  }

  if (!estado.proyecto_id) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Primero elige la obra con el comando (<code>/entrada</code> o <code>/salida</code>).',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'sin_obra' };
  }

  const fileId = fileIdFotoTelegramMaxResolucion(params.photo);
  if (!fileId) return { handled: true, motivo: 'sin_file_id' };

  try {
    const { buffer, filePath } = await downloadTelegramFile(fileId);
    const mimeType = mimeFromTelegramPath(filePath);
    const ext = filePath.split('.').pop() ?? 'jpg';
    const { storagePath, publicUrl } = await subirFotoMovimiento(
      params.supabase,
      estado.proyecto_id,
      tipo,
      buffer,
      mimeType,
      ext,
    );

    let lineasOcr: LineaOcrSalida[] = [];
    let ocrOk = false;
    if (tipo === 'salida') {
      try {
        const { data } = await extractPurchaseInvoiceFromFile({
          buffer,
          mimeType,
          fileName: `salida-obra.${ext}`,
        });
        lineasOcr = await matchearLineasOcrSalida(params.supabase, data.items ?? []);
        ocrOk = lineasConMatch(lineasOcr).length > 0;
      } catch (err) {
        console.warn('[telegram salida OCR]', err);
      }
    }

    const metadataActualizado: MetadataEntradaSalida = {
      ...meta(estado),
      paso: 'observacion',
      foto_storage_path: storagePath,
      foto_url: publicUrl ?? undefined,
      telegram_user_id: params.userId,
      telegram_username: params.username ?? null,
      lineas_ocr: lineasOcr,
      ocr_ok: ocrOk,
    };

    const caption = params.caption?.trim();
    if (caption && caption.length >= MIN_OBS) {
      await finalizarMovimiento(
        params.supabase,
        params.chatId,
        { ...estado, metadata: metadataActualizado },
        caption,
      );
      return { handled: true, motivo: 'foto_y_caption' };
    }

    await setTelegramContexto(params.supabase, params.chatId, {
      metadata: metadataActualizado,
    });

    if (tipo === 'salida' && lineasOcr.length) {
      await sendTelegramMessage(params.chatId, resumenLineasOcr(lineasOcr), { parse_mode: 'HTML' });
    }

    await sendTelegramMessage(params.chatId, mensajePedirObservacion(tipo), {
      parse_mode: 'HTML',
    });
    return { handled: true, motivo: 'foto_ok' };
  } catch (err) {
    console.error('[telegram entrada/salida foto]', err);
    await sendTelegramMessage(
      params.chatId,
      '❌ No se pudo guardar la foto. Intenta de nuevo.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'error_foto' };
  }
}

export async function manejarTextoObservacionEntradaSalida(params: {
  supabase: SupabaseClient;
  chatId: string;
  texto: string;
}): Promise<ResultadoEntradaSalida> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!contextoEsSalidaObra(estado.contexto)) {
    return { handled: false };
  }

  const paso = meta(estado).paso;
  if (paso === 'origen') {
    await sendTelegramMessage(
      params.chatId,
      '📦 Elige el <b>almacén de origen</b> con los botones del mensaje anterior.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'esperando_origen' };
  }

  if (paso !== 'observacion' || !meta(estado).foto_storage_path) {
    if (paso === 'foto' && estado.proyecto_id) {
      await sendTelegramMessage(
        params.chatId,
        '📷 Envía primero la <b>foto</b> del material. Luego escribe la observación.',
        { parse_mode: 'HTML' },
      );
      return { handled: true, motivo: 'esperando_foto' };
    }
    return { handled: false };
  }

  await finalizarMovimiento(params.supabase, params.chatId, estado, params.texto);
  return { handled: true, motivo: 'observacion_ok' };
}

export function esComandoEntrada(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/entrada';
}

export function esComandoSalida(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/salida';
}
