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

/** Mensaje al activar modo recepción de facturas por Telegram. */
export function mensajeModoFacturasActivado(): string {
  const link = `${baseUrlAppTelegram()}/contabilidad/compras/canal`;
  return (
    '✅ <b>Listo para recibir factura.</b>\n\n' +
    'Leí tu comando: modo <b>facturas</b> activo.\n' +
    'Envía ahora una <b>foto</b> o <b>PDF</b> de la factura de compra.\n\n' +
    '• La analizaré con IA (Gemini)\n' +
    '• Quedará pendiente para registrar la compra en contabilidad\n\n' +
    `📲 <a href="${link}">Abrir cargas Telegram en Casa Inteligente</a>`
  );
}
