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
    'Listo oara recibir factura.\n' +
    'Envia ahora una foto o Pdf de la factura de compra.'
  );
}
