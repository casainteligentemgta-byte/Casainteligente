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
    '✅ <b>Modo comprador — cargar facturas</b>\n\n' +
    'Envía una <b>foto</b> o <b>PDF</b> de la factura de compra.\n\n' +
    'El sistema la enviará a <b>Contabilidad</b> (Auditoría puede corregir en la app) ' +
    'y la <b>precargará</b> para que el depositario ingrese la mercancía con ' +
    '<code>/ingresofactura</code> cuando llegue al almacén.\n\n' +
    '<code>/cancelar</code> para salir de este modo.'
  );
}
