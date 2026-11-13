import type { SupabaseClient } from '@supabase/supabase-js';
import {
  monedaExtractedConfirmada,
  simboloMonedaExtracted,
} from '@/lib/contabilidad/extractedCanal';
import {
  esNotaEntregaCanal,
  notaEntregaDatosCompletos,
} from '@/lib/compras/notaEntregaCanal';
import { sendTelegramMessage } from '@/lib/telegram/botApi';

/** Horas Caracas (UTC−4) en las que corre el recordatorio: 9:00 y 15:00. */
export const HORAS_RECORDATORIO_CARACAS = [9, 15] as const;

/** Estados del canal que aún hay que confirmar (o rehacer la foto). */
export const ESTADOS_PENDIENTES_CONFIRMAR = ['extraido', 'error', 'error_ocr'] as const;

export const MAX_LINEAS_FACTURA_RECORDATORIO = 15;

const ZONA = 'America/Caracas';
const HINT_FOTO = 'tómale de nuevo la foto completa y reenvíala';
const SELECT_PENDIENTES =
  'id, chat_id, estado, purchase_invoice_id, extracted, entidad_id, proyecto_id, created_at';
const HINT_NOTA_FALTAN = 'nota de entrega: faltan datos';

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

export type FacturaRecordatorioComprador = {
  id: string;
  chatId: string;
  createdAt: string;
  numero: string | null;
  proveedor: string | null;
  fecha: string | null;
  monto: number | null;
  moneda: string | null;
  preciosEnCero: boolean;
  esNotaEntrega: boolean;
  datosCompletos: boolean;
};

export type ResultadoRecordatorioCompradores = {
  total: number;
  enviados: number;
  omitidos: number;
  facturas: number;
};

type FilaPendienteCanal = {
  id?: string | null;
  chat_id?: string | number | null;
  estado?: string | null;
  purchase_invoice_id?: string | null;
  extracted?: Record<string, unknown> | null;
  entidad_id?: string | null;
  proyecto_id?: string | null;
  created_at?: string | null;
};

/** Hora y día de la semana actuales en Caracas. Pura salvo por la fecha que recibe. */
export function ventanaCaracas(fecha: Date): { hora: number; diaSemana: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(fecha);
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? '-1') % 24;
  const dia = partes.find((p) => p.type === 'weekday')?.value ?? '';
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hora, diaSemana: mapa[dia] ?? -1 };
}

/** Lunes a viernes, a las 9:00 y 15:00 hora Caracas. */
export function esHoraDeRecordatorio(fecha: Date): boolean {
  const { hora, diaSemana } = ventanaCaracas(fecha);
  const laboral = diaSemana >= 1 && diaSemana <= 5;
  return laboral && (HORAS_RECORDATORIO_CARACAS as readonly number[]).includes(hora);
}

export function urlConfirmarFacturaCanal(id: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/contabilidad/compras/telegram/${id}`;
}

/** Sin purchase_invoice_id y en extraído / error (espera confirmación o foto ilegible). */
export function esFacturaPendienteDeConfirmar(row: {
  estado?: string | null;
  purchase_invoice_id?: string | null;
}): boolean {
  if (String(row.purchase_invoice_id ?? '').trim()) return false;
  const estado = String(row.estado ?? '').toLowerCase();
  return (ESTADOS_PENDIENTES_CONFIRMAR as readonly string[]).includes(estado);
}

/** Factura ilegible: faltan proveedor y moneda. Las notas de entrega no piden foto. */
export function facturaNecesitaNuevaFoto(
  f: Pick<FacturaRecordatorioComprador, 'proveedor' | 'moneda' | 'preciosEnCero'> & {
    esNotaEntrega?: boolean;
  },
): boolean {
  if (f.esNotaEntrega) return false;
  const sinProveedor = !String(f.proveedor ?? '').trim();
  const sinMoneda = !monedaExtractedConfirmada(f.moneda);
  return sinProveedor && sinMoneda;
}

export function facturaDesdePendienteCanal(
  row: FilaPendienteCanal,
): FacturaRecordatorioComprador | null {
  const id = String(row.id ?? '').trim();
  const chatId = String(row.chat_id ?? '').trim();
  if (!id || !chatId || !esFacturaPendienteDeConfirmar(row)) return null;

  const ex = (row.extracted ?? {}) as Record<string, unknown>;
  const items = Array.isArray(ex.items) ? ex.items : [];
  const precios: number[] = [];
  const monto = numeroONull(ex.total_amount);
  if (monto != null) precios.push(monto);
  for (const it of items) {
    const precio = numeroONull(
      it && typeof it === 'object' ? (it as { unit_price?: unknown }).unit_price : null,
    );
    if (precio != null) precios.push(precio);
  }

  const fechaExtracted = textoONull(ex.date);
  const createdAt = String(row.created_at ?? '').trim();
  const preciosEnCero = precios.length === 0 || precios.every((p) => p === 0);
  const esNota = esNotaEntregaCanal(ex);

  return {
    id,
    chatId,
    createdAt,
    numero: textoONull(ex.invoice_number ?? ex.numero),
    proveedor: textoONull(ex.supplier_name ?? ex.proveedor),
    fecha: fechaExtracted ?? (createdAt.slice(0, 10) || null),
    monto: esNota ? null : monto,
    moneda: textoONull(ex.moneda),
    preciosEnCero,
    esNotaEntrega: esNota,
    datosCompletos: notaEntregaDatosCompletos(ex, {
      entidad_id: row.entidad_id,
      proyecto_id: row.proyecto_id,
    }),
  };
}

/** Encabezado + una línea por factura (máx. 15 más antiguas). Null si no hay pendientes. */
export function construirMensajeRecordatorioComprador(
  facturas: FacturaRecordatorioComprador[],
  opts?: { baseUrl?: string; maxLineas?: number },
): string | null {
  if (!facturas.length) return null;
  const max = opts?.maxLineas ?? MAX_LINEAS_FACTURA_RECORDATORIO;
  const baseUrl = (opts?.baseUrl ?? baseUrlApp()).replace(/\/$/, '');
  const ordenadas = [...facturas].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const n = ordenadas.length;
  const visibles = ordenadas.slice(0, Math.max(0, max));
  const resto = n - visibles.length;
  const encabezado =
    n === 1
      ? 'Tienes 1 factura pendiente de confirmar:'
      : `Tienes ${n} facturas pendientes de confirmar:`;
  const lineas = [encabezado, ...visibles.map((f) => formatearLineaFacturaRecordatorio(f, baseUrl))];
  if (resto > 0) lineas.push(`y ${resto} más`);
  return lineas.join('\n');
}

export function formatearLineaFacturaRecordatorio(
  f: FacturaRecordatorioComprador,
  _baseUrl?: string,
): string {
  const partes = [
    f.numero?.trim() ? escHtml(f.numero.trim()) : 'sin número',
    f.proveedor?.trim() ? escHtml(f.proveedor.trim()) : 'sin proveedor',
  ];
  const fecha = f.fecha?.trim() ? formatearFechaCorta(f.fecha.trim()) : '';
  if (fecha) partes.push(escHtml(fecha));
  if (!f.esNotaEntrega && f.monto != null) {
    const sufijo = monedaExtractedConfirmada(f.moneda)
      ? ` ${simboloMonedaExtracted(f.moneda)}`
      : '';
    partes.push(`${formatearMontoEs(f.monto)}${sufijo}`);
  }
  if (f.esNotaEntrega) {
    partes.push(f.datosCompletos ? 'nota de entrega' : HINT_NOTA_FALTAN);
  } else if (facturaNecesitaNuevaFoto(f)) {
    partes.push(HINT_FOTO);
  }
  return `• ${partes.join(' · ')}`;
}

/** Chats de compradores activos: usuarios de Telegram con rol Comprador y nómina de obra. */
export async function listarChatIdsCompradores(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>();
  const { data: usuarios } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .select('telegram_id')
    .eq('rol', 'Comprador')
    .eq('activo', true);
  for (const r of usuarios ?? []) {
    if (r.telegram_id != null) ids.add(String(r.telegram_id));
  }
  const { data: nomina } = await supabase
    .from('ci_proyecto_nomina')
    .select('telegram_chat_id')
    .eq('rol', 'comprador')
    .eq('activo', true);
  for (const r of nomina ?? []) {
    if (r.telegram_chat_id) ids.add(String(r.telegram_chat_id));
  }
  return Array.from(ids);
}

export async function listarFacturasPendientesConfirmarPorChat(
  supabase: SupabaseClient,
  chatIds: string[],
): Promise<Map<string, FacturaRecordatorioComprador[]>> {
  const porChat = new Map<string, FacturaRecordatorioComprador[]>();
  if (!chatIds.length) return porChat;

  const filas: FilaPendienteCanal[] = [];
  for (let i = 0; i < chatIds.length; i += 200) {
    const chunk = chatIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select(SELECT_PENDIENTES)
      .in('estado', [...ESTADOS_PENDIENTES_CONFIRMAR])
      .in('chat_id', chunk)
      .order('created_at', { ascending: true })
      .limit(2000);
    if (error) {
      if (tablaAusente(error.message)) return porChat;
      throw new Error(error.message);
    }
    filas.push(...((data ?? []) as FilaPendienteCanal[]));
  }

  for (const row of filas) {
    const factura = facturaDesdePendienteCanal(row);
    if (!factura) continue;
    const lista = porChat.get(factura.chatId) ?? [];
    lista.push(factura);
    porChat.set(factura.chatId, lista);
  }
  return porChat;
}

export async function enviarRecordatorioCompradores(
  supabase: SupabaseClient,
  opts?: {
    baseUrl?: string;
    enviar?: (chatId: string, html: string) => Promise<void>;
    reanudarNotaEntrega?: (chatId: string, pendingId: string) => Promise<void>;
  },
): Promise<ResultadoRecordatorioCompradores> {
  const chats = await listarChatIdsCompradores(supabase);
  const porChat = await listarFacturasPendientesConfirmarPorChat(supabase, chats);
  const baseUrl = (opts?.baseUrl ?? baseUrlApp()).replace(/\/$/, '');
  const enviar =
    opts?.enviar ??
    (async (chatId: string, texto: string) => {
      await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
    });
  const reanudarNota =
    opts?.reanudarNotaEntrega ??
    (async (chatId: string, pendingId: string) => {
      const { avanzarFlujoNotaEntregaCompradorTelegram } = await import(
        '@/lib/telegram/notaEntregaCompradorTelegram'
      );
      await avanzarFlujoNotaEntregaCompradorTelegram(supabase, chatId, pendingId);
    });

  let enviados = 0;
  let omitidos = 0;
  let facturas = 0;
  for (const chatId of chats) {
    const pendientes = porChat.get(chatId) ?? [];
    if (!pendientes.length) {
      omitidos += 1;
      continue;
    }
    const html = construirMensajeRecordatorioComprador(pendientes, { baseUrl });
    if (!html) {
      omitidos += 1;
      continue;
    }
    facturas += pendientes.length;
    try {
      await enviar(chatId, html);
      enviados += 1;
      const incompleta = pendientes.find((f) => f.esNotaEntrega && !f.datosCompletos);
      if (incompleta) {
        try {
          await reanudarNota(chatId, incompleta.id);
        } catch (err) {
          console.warn('[recordatorio compradores] nota entrega', chatId, err);
        }
      }
    } catch (err) {
      console.warn('[recordatorio compradores]', chatId, err);
    }
  }
  return { total: chats.length, enviados, omitidos, facturas };
}

function textoONull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

function numeroONull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatearFechaCorta(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return raw;
}

/** 1500 → "1.500,00" (es-VE, determinista). */
export function formatearMontoEs(n: number): string {
  const negativo = n < 0;
  const abs = Math.abs(n);
  const [entero, dec = '00'] = abs.toFixed(2).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}${conMiles},${dec}`;
}

function tablaAusente(message: string | undefined): boolean {
  return /does not exist|42P01|schema cache/i.test(String(message ?? ''));
}
