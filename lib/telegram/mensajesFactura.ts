/** URL base de la app (misma lógica que mediaHandlers). */
export function baseUrlAppTelegram(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

/** Mensaje al activar modo recepción de facturas por Telegram (/facturas). */
export function mensajeModoFacturasActivado(): string {
  return (
    '✅ <b>Listo para recibir factura.</b>\n\n' +
    'Envía ahora una <b>foto</b> o <b>PDF</b> de la factura de compra.'
  );
}
