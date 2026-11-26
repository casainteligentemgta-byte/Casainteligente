import type { SupabaseClient } from '@supabase/supabase-js';
import { descargarArchivosPendienteCanal } from '@/lib/canal/documentPartsPendiente';
import {
  OCR_ATASCADO_EDAD_MAX_MS,
  OCR_PROCESANDO_ATASCADO_MS,
  columnasOcrDesconocidas,
  decidirProcesandoAtascado,
  esCandidatoReintentoOcr,
  listarPendientesOcrReintento,
  reclamarReintentoOcr,
  type FilaReintentoOcr,
} from '@/lib/canal/reintentoExtraccionFactura';

export type ResultadoReintentosOcr = {
  revisadas: number;
  reclamadas: number;
  ok: number;
  errores: number;
};

async function procesarFilaReintentoOcr(
  supabase: SupabaseClient,
  row: FilaReintentoOcr,
): Promise<void> {
  const archivos = await descargarArchivosPendienteCanal(supabase, row);
  if (archivos.length === 0) {
    throw new Error('No hay archivo en storage para reprocesar.');
  }
  const primario = archivos[0];
  const canal = row.canal === 'whatsapp' ? 'whatsapp' : 'telegram';
  const chatId = String(row.chat_id ?? '').trim();
  const [{ processInvoiceFromCanal }, { sendTelegramMessage }] = await Promise.all([
    import('@/lib/canal/processInvoiceFromCanal'),
    import('@/lib/telegram/botApi'),
  ]);
  // El comprador ve el mismo mensaje de estado («Leyendo factura…» → ✅ / ❌), no uno nuevo.
  let progreso:
    | Awaited<ReturnType<typeof crearProgresoTelegramReintento>>
    | undefined;
  if (canal === 'telegram' && chatId) {
    progreso = await crearProgresoTelegramReintento(supabase, row.id, chatId);
  }
  try {
    await processInvoiceFromCanal({
      canal,
      pendingId: row.id,
      chatId: chatId || 'ocr-reintento',
      buffer: primario.buffer,
      mimeType: primario.mimeType,
      fileName: primario.fileName,
      archivos,
      sendReply: async (text, html) => {
        if (canal !== 'telegram' || !chatId) return;
        await sendTelegramMessage(chatId, text, html ? { parse_mode: 'HTML' } : undefined);
      },
      progreso,
    });
  } catch (e) {
    // El reintento falló: la fila no puede quedar en `procesando` para siempre.
    await marcarErrorTrasReintento(supabase, row.id, e);
    throw e;
  }
}

async function crearProgresoTelegramReintento(
  supabase: SupabaseClient,
  pendingId: string,
  chatId: string,
) {
  const { crearProgresoFacturaTelegram, leerMensajeEstadoLectura } = await import(
    '@/lib/telegram/estadoLecturaFactura'
  );
  const messageId = await leerMensajeEstadoLectura(supabase, pendingId);
  return crearProgresoFacturaTelegram(chatId, { supabase, pendingId, messageId });
}

async function marcarErrorTrasReintento(
  supabase: SupabaseClient,
  pendingId: string,
  err: unknown,
): Promise<void> {
  const raw = err instanceof Error ? err.message : String(err ?? 'Error al reintentar');
  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'error',
      mensaje_error: raw.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId)
    .eq('estado', 'procesando');
  if (error) console.warn('[reintentarOcr] marcar error', error.message);
}

const SELECT_REINTENTO =
  'id,estado,canal,chat_id,document_storage_path,document_mime_type,document_file_name,document_parts,ocr_intentos,ocr_proximo_reintento_at,updated_at,mensaje_error';

/**
 * Encadenado (waitUntil) o cron: una factura concreta, con la foto ya guardada.
 * `forzar` ignora `ocr_proximo_reintento_at` para no esperar al cron diario.
 */
export async function reintentarOcrPendientePorId(
  supabase: SupabaseClient,
  pendingId: string,
  opts?: {
    forzar?: boolean;
    ahora?: Date;
    procesar?: (row: FilaReintentoOcr) => Promise<void>;
  },
): Promise<ResultadoReintentosOcr> {
  const out: ResultadoReintentosOcr = {
    revisadas: 0,
    reclamadas: 0,
    ok: 0,
    errores: 0,
  };
  const id = pendingId.trim();
  if (!id) return out;

  const sel = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(SELECT_REINTENTO)
    .eq('id', id)
    .maybeSingle();
  if (sel.error) {
    if (columnasOcrDesconocidas(sel.error.message)) return out;
    throw new Error(sel.error.message);
  }
  const row = (sel.data ?? null) as FilaReintentoOcr | null;
  if (!row) return out;
  out.revisadas = 1;
  const ahoraMs = (opts?.ahora ?? new Date()).getTime();
  if (!esCandidatoReintentoOcr(row, ahoraMs, { forzar: opts?.forzar !== false })) {
    return out;
  }
  const claimed = await reclamarReintentoOcr(supabase, row.id);
  if (!claimed) return out;
  out.reclamadas = 1;
  const procesar = opts?.procesar ?? ((r) => procesarFilaReintentoOcr(supabase, r));
  try {
    await procesar(row);
    out.ok = 1;
  } catch (e) {
    out.errores = 1;
    console.warn(
      '[reintentarOcrPendientePorId]',
      row.id,
      e instanceof Error ? e.message : e,
    );
  }
  return out;
}

/**
 * Cron diario (red de seguridad) o lote: reintenta OCR con las fotos ya guardadas.
 * No avisa al cargador aquí: `processInvoiceFromCanal` solo avisa al agotar los 3 intentos.
 */
export async function reintentarOcrPendientesCanal(
  supabase: SupabaseClient,
  opts?: {
    limite?: number;
    ahora?: Date;
    procesar?: (row: FilaReintentoOcr) => Promise<void>;
  },
): Promise<ResultadoReintentosOcr> {
  const filas = await listarPendientesOcrReintento(supabase, {
    limite: opts?.limite ?? 5,
    ahora: opts?.ahora,
  });
  const out: ResultadoReintentosOcr = {
    revisadas: filas.length,
    reclamadas: 0,
    ok: 0,
    errores: 0,
  };
  const procesar = opts?.procesar ?? ((row) => procesarFilaReintentoOcr(supabase, row));

  for (const row of filas) {
    const claimed = await reclamarReintentoOcr(supabase, row.id);
    if (!claimed) continue;
    out.reclamadas += 1;
    try {
      await procesar(row);
      out.ok += 1;
    } catch (e) {
      out.errores += 1;
      console.warn(
        '[reintentarOcrPendientesCanal]',
        row.id,
        e instanceof Error ? e.message : e,
      );
    }
  }
  return out;
}

export type ResultadoRescateAtascadas = {
  revisadas: number;
  reintentadas: number;
  agotadas: number;
  ok: number;
  errores: number;
};

const SELECT_ATASCADAS = `${SELECT_REINTENTO},aviso_error_enviado_at`;

/** Cierra una lectura atascada sin salida: estado error y UN solo aviso ❌ al comprador. */
async function agotarLecturaAtascada(
  supabase: SupabaseClient,
  row: FilaReintentoOcr & { aviso_error_enviado_at?: string | null },
): Promise<void> {
  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'error',
      mensaje_error: 'Lectura atascada: no se pudo leer la foto. Reenviar.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('estado', 'procesando');
  if (row.canal === 'whatsapp') return;
  const chatId = String(row.chat_id ?? '').trim();
  if (!chatId || row.aviso_error_enviado_at) return;

  const { textoAvisoErrorCarga, avisarErrorCargaFacturaCanal } = await import(
    '@/lib/telegram/avisoErrorCargaFactura'
  );
  let mostrado = false;
  try {
    const progreso = await crearProgresoTelegramReintento(supabase, row.id, chatId);
    await progreso.bad(textoAvisoErrorCarga('general'));
    mostrado = true;
  } catch {
    /* si no se pudo editar, el aviso sale como mensaje nuevo */
  }
  await avisarErrorCargaFacturaCanal({
    pendingId: row.id,
    chatId,
    tipo: 'general',
    supabase,
    yaMostrado: mostrado,
  });
}

/**
 * Red de seguridad para lecturas colgadas en `procesando` (p. ej. la función cayó antes del
 * primer intento: ocr_intentos 0). Cada una se reintenta una vez o se cierra con error y
 * aviso ❌ al comprador. Pensado para correr cada pocos minutos.
 */
export async function rescatarLecturasAtascadas(
  supabase: SupabaseClient,
  opts?: {
    limite?: number;
    ahora?: Date;
    /** Tiempo máximo para empezar reintentos nuevos (la función dura 180 s). */
    presupuestoMs?: number;
    procesar?: (row: FilaReintentoOcr) => Promise<void>;
  },
): Promise<ResultadoRescateAtascadas> {
  const out: ResultadoRescateAtascadas = {
    revisadas: 0,
    reintentadas: 0,
    agotadas: 0,
    ok: 0,
    errores: 0,
  };
  const ahora = opts?.ahora ?? new Date();
  const ahoraMs = ahora.getTime();
  const inicio = Date.now();
  const presupuestoMs = opts?.presupuestoMs ?? 100_000;
  const limite = opts?.limite ?? 3;
  const hasta = new Date(ahoraMs - OCR_PROCESANDO_ATASCADO_MS).toISOString();
  const desde = new Date(ahoraMs - OCR_ATASCADO_EDAD_MAX_MS).toISOString();

  const sel = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(SELECT_ATASCADAS)
    .eq('estado', 'procesando')
    .is('extracted', null)
    .lte('updated_at', hasta)
    .gte('updated_at', desde)
    .order('updated_at', { ascending: true })
    .limit(20);
  if (sel.error) {
    if (columnasOcrDesconocidas(sel.error.message) || /aviso_error_enviado_at/.test(sel.error.message)) {
      return out;
    }
    throw new Error(sel.error.message);
  }
  const filas = (sel.data ?? []) as unknown as Array<
    FilaReintentoOcr & { aviso_error_enviado_at?: string | null }
  >;
  const procesar = opts?.procesar ?? ((r) => procesarFilaReintentoOcr(supabase, r));

  for (const row of filas) {
    if (out.reintentadas + out.agotadas >= limite) break;
    const decision = decidirProcesandoAtascado(row, ahoraMs);
    if (decision === 'ignorar') continue;
    out.revisadas += 1;

    if (decision === 'agotar') {
      out.agotadas += 1;
      try {
        await agotarLecturaAtascada(supabase, row);
      } catch (e) {
        out.errores += 1;
        console.warn('[rescatarLecturasAtascadas] agotar', row.id, e instanceof Error ? e.message : e);
      }
      continue;
    }

    if (Date.now() - inicio > presupuestoMs) break;
    // Reclamo atómico: dos barridos a la vez no leen la misma foto. Cuenta como 1.er intento.
    const { data: reclamada, error: errReclamo } = await supabase
      .from('ci_facturas_canal_pendientes')
      .update({ ocr_intentos: 1, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('estado', 'procesando')
      .eq('ocr_intentos', 0)
      .lte('updated_at', hasta)
      .select('id')
      .maybeSingle();
    if (errReclamo || !reclamada?.id) continue;
    out.reintentadas += 1;
    try {
      await procesar({ ...row, ocr_intentos: 1 });
      out.ok += 1;
    } catch (e) {
      out.errores += 1;
      console.warn('[rescatarLecturasAtascadas] reintento', row.id, e instanceof Error ? e.message : e);
    }
  }
  return out;
}
