import {
  editTelegramMessage,
  sendTelegramChatAction,
  sendTelegramMessageWithId,
} from '@/lib/telegram/botApi';

export const TEXTO_ESPERA_SIGUIENTE = 'Espera mi confirmación antes de mandar la siguiente.';
export const TEXTO_YA_PUEDES_MANDAR = 'Ya puedes mandar la próxima';
export const TEXTO_LECTURA_FALLIDA = '❌ No pude leer la foto, mándala de nuevo';
export const TEXTO_LEYENDO_ANTERIOR = 'Todavía estoy leyendo la anterior, espera un momento';

function barraProgreso(pct: number): string {
  const total = 10;
  const filled = Math.max(0, Math.min(total, Math.round((pct / 100) * total)));
  return `${'█'.repeat(filled)}${'░'.repeat(total - filled)}`;
}

function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Mensaje «Leyendo factura…»: el reloj de arena alterna en cada edición para que se vea vivo. */
export function textoLeyendoFactura(pct: number, etapa: string, tick: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const icono = tick % 2 === 0 ? '⏳' : '⌛';
  return (
    `${icono} <b>Leyendo factura… ${p}%</b>\n` +
    `<code>${barraProgreso(p)}</code>\n` +
    `<i>${escaparHtml(etapa)}</i>\n\n` +
    TEXTO_ESPERA_SIGUIENTE
  );
}

export type DatosFacturaLista = {
  invoice_number?: unknown;
  supplier_name?: unknown;
};

export function textoFacturaLista(datos?: DatosFacturaLista | null, detalleHtml = ''): string {
  const numero = String(datos?.invoice_number ?? '').trim();
  const proveedor = String(datos?.supplier_name ?? '').trim();
  const base = datos
    ? `✅ Lista la factura ${escaparHtml(numero || 'sin número')}` +
      `${proveedor ? ` de ${escaparHtml(proveedor)}` : ''}. ${TEXTO_YA_PUEDES_MANDAR}`
    : `✅ Lectura terminada. ${TEXTO_YA_PUEDES_MANDAR}`;
  const extra = String(detalleHtml ?? '').trim();
  return extra ? `${base}\n<i>${extra}</i>` : base;
}

export function textoLecturaFallida(detalle: string): string {
  const d = String(detalle ?? '').trim();
  if (d.startsWith('⚠️') || d.startsWith('❌')) return d;
  return d ? `${TEXTO_LECTURA_FALLIDA}.\n\n${d}` : `${TEXTO_LECTURA_FALLIDA}.`;
}

export type NotificadorProgresoFacturaTelegram = {
  reportar: (pct: number, etapa: string) => Promise<void>;
  ok: (detalleHtml: string, datos?: DatosFacturaLista | null) => Promise<void>;
  bad: (detalle: string) => Promise<void>;
  /** Cierra el mensaje de estado con un texto libre (HTML) sin dejarlo «leyendo» para siempre. */
  cerrar: (textoHtml: string) => Promise<void>;
  /** Devuelve true si el mensaje de estado ya existe (se puede editar). */
  tieneMensaje: () => boolean;
};

export type OpcionesNotificadorProgreso = {
  /** Mensaje de estado ya enviado antes (reintento desde otra invocación): se edita, no se duplica. */
  messageId?: number | null;
  /** Se llama una vez al crear el mensaje, para guardar su id y poder editarlo después. */
  onMessageId?: (id: number) => void | Promise<void>;
};

/**
 * Mensaje único en Telegram que se actualiza con % y termina en ✅ o ❌.
 * Las operaciones van en cola para que una edición tardía nunca pise el resultado final.
 */
export function crearNotificadorProgresoFacturaTelegram(
  chatId: string,
  opts?: OpcionesNotificadorProgreso,
): NotificadorProgresoFacturaTelegram {
  let messageId: number | null = opts?.messageId ?? null;
  let tick = 0;
  let terminado = false;
  let cola: Promise<void> = Promise.resolve();

  function encolar(op: () => Promise<void>): Promise<void> {
    const siguiente = cola.then(op);
    cola = siguiente.catch(() => {});
    return siguiente;
  }

  async function mostrar(text: string): Promise<void> {
    if (messageId == null) {
      const id = await sendTelegramMessageWithId(chatId, text, { parse_mode: 'HTML' });
      messageId = id;
      try {
        await opts?.onMessageId?.(id);
      } catch {
        /* sin columna de estado: el final llega igual en este mismo proceso */
      }
      return;
    }
    await editTelegramMessage(chatId, messageId, text, { parse_mode: 'HTML' });
  }

  function reportar(pct: number, etapa: string): Promise<void> {
    return encolar(async () => {
      if (terminado) return;
      // «enviando foto…» bajo el nombre del bot; dura ~5 s y se renueva con cada edición.
      void sendTelegramChatAction(chatId, 'upload_photo');
      const text = textoLeyendoFactura(pct, etapa, tick);
      tick += 1;
      await mostrar(text);
    });
  }

  function final(text: string): Promise<void> {
    return encolar(async () => {
      terminado = true;
      await mostrar(text);
    });
  }

  return {
    reportar,
    ok: (detalleHtml, datos) => final(textoFacturaLista(datos, detalleHtml)),
    bad: (detalle) => final(textoLecturaFallida(detalle)),
    cerrar: (textoHtml) => final(textoHtml),
    tieneMensaje: () => messageId != null,
  };
}

/** Avance simulado mientras corre una tarea larga (p. ej. Gemini). */
export async function conProgresoSimulado(
  desde: number,
  hasta: number,
  reportar: (pct: number, etapa: string) => Promise<void>,
  etapa: string,
  trabajo: () => Promise<void>,
): Promise<void> {
  let pct = desde;
  const intervaloMs = 2500;
  const paso = Math.max(2, Math.floor((hasta - desde - 4) / 4));

  const timer = setInterval(() => {
    pct = Math.min(hasta - 4, pct + paso);
    void reportar(pct, etapa).catch(() => {});
  }, intervaloMs);

  try {
    await reportar(desde, etapa);
    await trabajo();
  } finally {
    clearInterval(timer);
    await reportar(hasta, etapa);
  }
}
