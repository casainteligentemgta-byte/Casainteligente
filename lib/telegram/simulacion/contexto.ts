/**
 * Modo ensayo del bot: dentro de este contexto nada sale hacia Telegram.
 *
 * Lo que el bot «enviaría» (mensajes, botones, alertas) queda capturado para revisarlo,
 * y las fotos que «recibiría» son una imagen de relleno. El resto del código del bot
 * (rutas, flujos, base de datos) corre tal cual en producción.
 *
 * El contexto vive en AsyncLocalStorage: solo afecta a la ejecución que lo abre, no a
 * otras peticiones que el mismo servidor esté atendiendo a la vez.
 *
 * Este archivo no importa nada de Node en la cabecera a propósito: botApi.ts llega
 * también al paquete del navegador (por tipos y utilidades compartidas) y un
 * `import 'node:async_hooks'` rompería la compilación. AsyncLocalStorage se obtiene
 * al abrir el primer ensayo, que siempre ocurre en el servidor.
 */

export type BotonSimulado = { texto: string; data: string | null; url: string | null };

export type EnvioSimulado = {
  metodo: string;
  chatId: string | null;
  texto: string | null;
  botones: BotonSimulado[];
  /** answerCallbackQuery con show_alert: ventana emergente que el usuario debe cerrar. */
  alerta: boolean;
};

/**
 * Persona del ensayo con rol en el departamento de compras (Solicitante, Contador,
 * PM, Comprador). Estos roles son globales en la tabla real: una fila ficticia allí
 * recibiría avisos de las obras de verdad. Por eso solo existen dentro del ensayo.
 */
export type UsuarioSistemaSimulado = {
  id: string;
  nombre: string;
  telegram_id: number;
  rol: 'Solicitante' | 'Aprobador' | 'Comprador' | 'Contador' | 'Administrador';
  proyecto_id: string | null;
};

export type ContextoSimulacionBot = {
  envios: EnvioSimulado[];
  siguienteMensajeId: number;
  /** Dentro de un ensayo, los únicos usuarios del departamento de compras son estos. */
  usuariosSistema: UsuarioSistemaSimulado[];
};

type AlmacenAsincrono = {
  getStore(): ContextoSimulacionBot | undefined;
  run<R>(store: ContextoSimulacionBot, fn: () => R): R;
};
type ConstructorAlmacen = new () => AlmacenAsincrono;

/** En `globalThis` para que todas las copias de este módulo compartan el mismo almacén. */
const compartido = globalThis as {
  __ciSimulacionBot?: AlmacenAsincrono;
  AsyncLocalStorage?: ConstructorAlmacen;
};

async function obtenerAlmacen(): Promise<AlmacenAsincrono> {
  if (compartido.__ciSimulacionBot) return compartido.__ciSimulacionBot;
  // Next.js deja AsyncLocalStorage como global en el servidor; fuera de Next se importa de Node.
  let Constructor = typeof compartido.AsyncLocalStorage === 'function' ? compartido.AsyncLocalStorage : null;
  if (!Constructor) {
    const modulo = 'node:async_hooks';
    const hooks = (await import(/* webpackIgnore: true */ modulo)) as { AsyncLocalStorage: ConstructorAlmacen };
    Constructor = hooks.AsyncLocalStorage;
  }
  compartido.__ciSimulacionBot = new Constructor();
  return compartido.__ciSimulacionBot;
}

/** Token ficticio: permite pasar las comprobaciones de «bot configurado» sin tener el real. */
export const TOKEN_BOT_SIMULADO = 'SIMULACION';

/** JPEG mínimo válido (1×1 px) para las fotos que el bot «descarga» en un ensayo. */
const JPEG_DE_RELLENO = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  'base64',
);

export function simulacionBotActiva(): ContextoSimulacionBot | undefined {
  return compartido.__ciSimulacionBot?.getStore();
}

/** Ejecuta `fn` con Telegram en modo captura y devuelve lo que el bot habría enviado. */
export async function enSimulacionBot<T>(
  fn: () => Promise<T>,
  opciones?: { usuariosSistema?: UsuarioSistemaSimulado[] },
): Promise<{ resultado: T; envios: EnvioSimulado[] }> {
  const contexto: ContextoSimulacionBot = {
    envios: [],
    siguienteMensajeId: 500_000,
    usuariosSistema: opciones?.usuariosSistema ?? [],
  };
  const almacen = await obtenerAlmacen();
  const resultado = await almacen.run(contexto, fn);
  return { resultado, envios: contexto.envios };
}

function botonesDe(replyMarkup: unknown): BotonSimulado[] {
  const filas = (replyMarkup as { inline_keyboard?: unknown } | null | undefined)?.inline_keyboard;
  if (!Array.isArray(filas)) return [];
  const botones: BotonSimulado[] = [];
  for (const fila of filas) {
    if (!Array.isArray(fila)) continue;
    for (const b of fila as Array<Record<string, unknown>>) {
      botones.push({
        texto: String(b?.text ?? ''),
        data: typeof b?.callback_data === 'string' ? b.callback_data : null,
        url: typeof b?.url === 'string' ? b.url : null,
      });
    }
  }
  return botones;
}

/**
 * Sustituye la llamada a la API de Telegram: registra el envío y responde lo mismo
 * que respondería Telegram en el caso feliz.
 */
export function responderTelegramSimulado(
  contexto: ContextoSimulacionBot,
  metodo: string,
  cuerpo: Record<string, unknown>,
): unknown {
  const texto = cuerpo.text ?? cuerpo.caption;
  contexto.envios.push({
    metodo,
    chatId: cuerpo.chat_id != null ? String(cuerpo.chat_id) : null,
    texto: texto != null ? String(texto) : null,
    botones: botonesDe(cuerpo.reply_markup),
    alerta: cuerpo.show_alert === true,
  });

  if (metodo === 'getFile') return { file_path: 'photos/ensayo.jpg' };
  if (/^send|^editMessage|^copyMessage|^forwardMessage/.test(metodo)) {
    contexto.siguienteMensajeId += 1;
    return { message_id: contexto.siguienteMensajeId };
  }
  return true;
}

/** Archivo que el bot «descarga» de Telegram durante un ensayo. */
export function archivoTelegramSimulado(): { buffer: Buffer; filePath: string } {
  return { buffer: Buffer.from(JPEG_DE_RELLENO), filePath: 'photos/ensayo.jpg' };
}

let ultimoTicketDeEnsayo = 0;

/**
 * Ticket para una procura creada en un ensayo. Lleva el año 0000 para que no se confunda
 * con uno real y no consume la secuencia de tickets de la base.
 */
export function ticketProcuraDeEnsayo(): string {
  ultimoTicketDeEnsayo = Math.max(ultimoTicketDeEnsayo + 1, Date.now() % 100_000);
  return `PR-0000-${String(ultimoTicketDeEnsayo % 100_000).padStart(5, '0')}`;
}
