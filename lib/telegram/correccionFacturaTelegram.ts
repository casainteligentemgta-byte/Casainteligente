import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { esChatCargaComprador } from '@/lib/telegram/compradorRestricciones';
import { getTelegramEstado, setTelegramContexto, type TelegramEstado } from '@/lib/telegram/estados';
import { parsearTotalEscrito } from '@/lib/telegram/faltantesFacturaTelegram';
import { MENSAJE_FACTURA_DUPLICADA, esErrorFacturaDuplicada } from '@/lib/canal/facturaDuplicada';

/**
 * Corrección de datos de una factura precargada desde Telegram. La puede hacer quien la
 * cargó (por ejemplo, el chofer con su foto) o un comprador / administrador / PM.
 * Cada cambio queda en ci_facturas_historial_cambios.
 */

export const PREFIX_CORRECCION = 'cx:';

/** Campo corregible: etiqueta visible y clave dentro de `extracted`. */
export const CAMPOS_CORREGIBLES = {
  numero: { etiqueta: 'Número', clave: 'invoice_number' },
  rif: { etiqueta: 'RIF', clave: 'supplier_rif' },
  proveedor: { etiqueta: 'Proveedor', clave: 'supplier_name' },
  fecha: { etiqueta: 'Fecha', clave: 'date' },
  total: { etiqueta: 'Total', clave: 'total_amount' },
} as const;

export type CampoCorregible = keyof typeof CAMPOS_CORREGIBLES;

const PASO_CORRECCION = 'corregir_campo';

export function esCampoCorregible(valor: string): valor is CampoCorregible {
  return Object.prototype.hasOwnProperty.call(CAMPOS_CORREGIBLES, valor);
}

/**
 * Convierte la fecha escrita a AAAA-MM-DD. Acepta AAAA-MM-DD y DD/MM/AAAA (también con - o .).
 * Rechaza fechas que no existen (ej. 31/02).
 */
export function parsearFechaEscrita(texto: string): string | null {
  const t = texto.trim();
  let y: number;
  let m: number;
  let d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
  } else {
    return null;
  }
  const fecha = new Date(Date.UTC(y, m - 1, d));
  if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export type ValorCorregido = { ok: true; valor: string | number } | { ok: false; mensaje: string };

/** Valida el texto escrito para el campo. Función pura, sin acceso a base de datos. */
export function valorCorregidoDesdeTexto(campo: CampoCorregible, texto: string): ValorCorregido {
  const valor = texto.trim();
  if (campo === 'numero') {
    if (!valor) return { ok: false, mensaje: '⚠️ Escriba el número de la factura o <code>S/N</code>.' };
    return { ok: true, valor: valor.toUpperCase() === 'S/N' ? 'S/N' : valor };
  }
  if (campo === 'rif') {
    if (!valor) return { ok: false, mensaje: '⚠️ Escriba el RIF del proveedor (ej. <code>J-12345678-9</code>).' };
    return { ok: true, valor: valor.toUpperCase() };
  }
  if (campo === 'proveedor') {
    if (valor.length < 2) return { ok: false, mensaje: '⚠️ Escriba el nombre del proveedor.' };
    return { ok: true, valor };
  }
  if (campo === 'fecha') {
    const iso = parsearFechaEscrita(valor);
    if (!iso) {
      return {
        ok: false,
        mensaje: '⚠️ Fecha no válida. Use <code>DD/MM/AAAA</code> (ej. <code>15/03/2026</code>).',
      };
    }
    return { ok: true, valor: iso };
  }
  const total = parsearTotalEscrito(valor);
  if (total == null) {
    return { ok: false, mensaje: '⚠️ Escriba un monto mayor que cero (ej. <code>1250.50</code>).' };
  }
  return { ok: true, valor: total };
}

export function esCallbackCorreccion(data: string): boolean {
  return data.startsWith(PREFIX_CORRECCION);
}

export function esperandoCorreccionFactura(estado: TelegramEstado): boolean {
  return (
    estado.contexto === 'factura' &&
    Boolean(estado.pending_factura_id) &&
    String(estado.metadata?.paso ?? '') === PASO_CORRECCION
  );
}

/** Quien cargó la factura (su chat) o un comprador, administrador o PM puede corregirla. */
export async function puedeCorregirFactura(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('chat_id')
    .eq('id', pendingId)
    .maybeSingle();
  if (!data) return false;
  if (String(data.chat_id) === String(chatId)) return true;
  return esChatCargaComprador(supabase, chatId);
}

/** Botones con los campos corregibles, dos por fila, bajo el resumen de la factura. */
export async function enviarOfertaCorreccion(chatId: string, pendingId: string): Promise<void> {
  const botones = (Object.keys(CAMPOS_CORREGIBLES) as CampoCorregible[]).map((campo) => ({
    text: `✏️ ${CAMPOS_CORREGIBLES[campo].etiqueta}`,
    callback_data: `${PREFIX_CORRECCION}${pendingId}:${campo}`,
  }));
  const filas: Array<typeof botones> = [];
  for (let i = 0; i < botones.length; i += 2) filas.push(botones.slice(i, i + 2));

  await sendTelegramMessage(
    chatId,
    '¿Algún dato leído está mal? Elija el campo a corregir.',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: filas } },
  );
}

export async function manejarCallbackCorreccion(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackCorreccion(params.data)) return false;
  await answerCallbackQuery(params.callbackId);

  const [pendingId, campo] = params.data.slice(PREFIX_CORRECCION.length).split(':');
  if (!pendingId || !campo || !esCampoCorregible(campo)) return true;

  if (!(await puedeCorregirFactura(supabase, params.chatId, pendingId))) {
    await sendTelegramMessage(
      params.chatId,
      '⛔ Solo quien cargó la factura o un comprador puede corregirla.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  await setTelegramContexto(supabase, params.chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: { paso: PASO_CORRECCION, campo, flujo: 'correccion_factura' },
  });
  await sendTelegramMessage(
    params.chatId,
    `✏️ Escriba el nuevo valor de <b>${CAMPOS_CORREGIBLES[campo].etiqueta}</b>.`,
    { parse_mode: 'HTML' },
  );
  return true;
}

/** Quita el paso de corrección y devuelve el chat al flujo que estaba. */
async function cerrarCorreccion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const resto = Object.fromEntries(
    Object.entries(estado.metadata ?? {}).filter(([k]) => k !== 'paso' && k !== 'campo'),
  );
  await setTelegramContexto(supabase, chatId, {
    contexto: estado.contexto,
    pending_factura_id: estado.pending_factura_id,
    metadata: resto,
    reemplazarMetadata: true,
  });
}

/**
 * Recibe el valor escrito para el campo corregido. Devuelve true si el mensaje era
 * respuesta a esta pregunta (aunque el valor sea inválido, para que se pueda reintentar).
 */
export async function manejarTextoCorreccionFactura(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esperandoCorreccionFactura(estado)) return false;

  const pendingId = estado.pending_factura_id as string;
  const campo = String(estado.metadata?.campo ?? '');
  if (!esCampoCorregible(campo)) return false;

  const valor = valorCorregidoDesdeTexto(campo, texto);
  if (!valor.ok) {
    await sendTelegramMessage(chatId, valor.mensaje, { parse_mode: 'HTML' });
    return true;
  }

  const { data: row } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', pendingId)
    .maybeSingle();
  const prev = (row?.extracted ?? {}) as Record<string, unknown>;
  const clave = CAMPOS_CORREGIBLES[campo].clave;
  const anterior = prev[clave];

  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted: { ...prev, [clave]: valor.valor },
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  if (esErrorFacturaDuplicada(error)) {
    // Otra carga ya tiene ese RIF y número: el cambio no se aplica.
    await cerrarCorreccion(supabase, chatId, estado);
    await sendTelegramMessage(chatId, `⚠️ <b>Factura duplicada</b>\n\n${MENSAJE_FACTURA_DUPLICADA}`, {
      parse_mode: 'HTML',
    });
    return true;
  }
  if (error) {
    await sendTelegramMessage(chatId, '⚠️ No pude guardar el dato. Intente de nuevo.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  await supabase.from('ci_facturas_historial_cambios').insert({
    tabla: 'ci_facturas_canal_pendientes',
    registro_id: pendingId,
    campo: clave,
    valor_anterior: anterior == null ? null : String(anterior),
    valor_nuevo: String(valor.valor),
    origen: 'telegram',
    actor: chatId,
  });

  await cerrarCorreccion(supabase, chatId, estado);
  await sendTelegramMessage(
    chatId,
    `✅ ${CAMPOS_CORREGIBLES[campo].etiqueta}: <b>${String(valor.valor)}</b>`,
    { parse_mode: 'HTML' },
  );
  return true;
}
