import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';

/**
 * Datos que el OCR no leyó y que el comprador debe escribir antes de confirmar.
 * Se piden de a uno: número de factura, total y fecha.
 * Sin fecha no se usa la de hoy: la tasa BCV debe ser la del día de la factura.
 */
export type CampoFaltanteFactura = 'numero' | 'total' | 'fecha';

export function campoFaltanteFactura(extracted: ExtractedCanalHeader): CampoFaltanteFactura | null {
  const numero = String(extracted.invoice_number ?? '').trim();
  if (!numero) return 'numero';
  const total = Number(extracted.total_amount);
  if (!(total > 0)) return 'total';
  if (!fechaIsoValida(String(extracted.date ?? '').slice(0, 10))) return 'fecha';
  return null;
}

function fechaIsoValida(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/**
 * Convierte la fecha escrita a AAAA-MM-DD. Acepta "18/11/2026", "18-11-2026", "18.11.2026"
 * y "2026-11-18". Devuelve null si no es una fecha real.
 */
export function parsearFechaEscrita(texto: string): string | null {
  const t = texto.trim();
  let iso: string | null = null;
  const dmy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t);
  if (dmy) {
    iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    iso = t;
  }
  return iso && fechaIsoValida(iso) ? iso : null;
}

export function esperandoDatoFaltanteFactura(estado: TelegramEstado): boolean {
  return (
    estado.contexto === 'factura' &&
    Boolean(estado.pending_factura_id) &&
    String(estado.metadata?.paso ?? '') === 'dato_faltante'
  );
}

/**
 * Convierte el monto escrito a número. Acepta "1250.50", "1.250,50" y "1250,50".
 * Devuelve null si no es un monto mayor que cero.
 */
export function parsearTotalEscrito(texto: string): number | null {
  let limpio = texto.trim().replace(/\s/g, '');
  if (limpio.includes(',')) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function enviarPreguntaDatoFaltanteFactura(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  campo: CampoFaltanteFactura,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: { paso: 'dato_faltante', campo, flujo: 'factura_compra' },
  });

  const texto =
    campo === 'numero'
      ? `🔢 <b>No leí el número de la factura.</b>\n\n` +
        `Escríbalo tal como aparece en la factura, o escriba <code>S/N</code> si no tiene número.`
      : campo === 'total'
        ? `💰 <b>No leí el total de la factura.</b>\n\n` +
          `Escriba el monto total (ej. <code>1250.50</code> o <code>1.250,50</code>).`
        : `📅 <b>No leí la fecha de la factura.</b>\n\n` +
          `Escríbala tal como aparece en la factura (ej. <code>18/11/2026</code>). ` +
          `La tasa BCV se toma de esa fecha.`;

  await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
}

/**
 * Recibe la respuesta escrita del comprador para el dato faltante.
 * Devuelve true si el mensaje era respuesta a esta pregunta (aunque sea inválida).
 */
export async function manejarTextoDatoFaltanteFactura(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
  avanzar: (supabase: SupabaseClient, chatId: string, pendingId: string) => Promise<unknown>,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esperandoDatoFaltanteFactura(estado)) return false;

  const pendingId = estado.pending_factura_id;
  if (!pendingId) return false;

  const campo = String(estado.metadata?.campo ?? '') as CampoFaltanteFactura;
  const valor = texto.trim();

  const { data: row } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', pendingId)
    .maybeSingle();
  const prev = (row?.extracted ?? {}) as ExtractedCanalHeader;

  let nextExtracted: ExtractedCanalHeader | null = null;
  let confirmacion = '';

  if (campo === 'numero') {
    if (!valor) {
      await sendTelegramMessage(chatId, '⚠️ Escriba el número de la factura o <code>S/N</code>.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const numero = valor.toUpperCase() === 'S/N' ? 'S/N' : valor;
    nextExtracted = { ...prev, invoice_number: numero };
    confirmacion = `✅ Número de factura: <b>${numero}</b>`;
  } else if (campo === 'fecha') {
    const fecha = parsearFechaEscrita(valor);
    if (!fecha) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Escriba una fecha válida (ej. <code>18/11/2026</code>).',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    nextExtracted = { ...prev, date: fecha };
    confirmacion = `✅ Fecha de la factura: <b>${fecha}</b>`;
  } else if (campo === 'total') {
    const total = parsearTotalEscrito(valor);
    if (total == null) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Escriba un monto mayor que cero (ej. <code>1250.50</code>).',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    nextExtracted = { ...prev, total_amount: total };
    confirmacion = `✅ Total: <b>${total.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>`;
  } else {
    return false;
  }

  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted: nextExtracted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  if (error) {
    await sendTelegramMessage(chatId, '⚠️ No pude guardar el dato. Intente de nuevo.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  await sendTelegramMessage(chatId, confirmacion, { parse_mode: 'HTML' });
  // Continúa con el siguiente dato faltante o con el resto del flujo del comprador.
  await avanzar(supabase, chatId, pendingId);
  return true;
}
