/** Comandos publicados en el menú de Telegram (setMyCommands). */
export const TELEGRAM_BOT_COMMANDS: Array<{ command: string; description: string }> = [
  { command: 'facturas', description: 'Recibir factura de compra (foto/PDF)' },
  { command: 'factura', description: 'Igual que /facturas' },
  { command: 'agua', description: 'Foto camión (placa) + prueba de agua' },
  { command: 'entrada', description: 'Material que ingresa a la obra (foto + detalle)' },
  { command: 'salida', description: 'Material que egresa de la obra (foto + detalle)' },
  { command: 'memoria', description: 'Memoria descriptiva: foto de avance por partida' },
  { command: 'obra', description: 'Elegir obra y subir fotos de evidencia' },
  { command: 'gasto', description: 'Comprobante de gasto de obra' },
  { command: 'bitacora', description: 'Bitácora por nota de voz' },
  { command: 'stock', description: 'Consultar inventario por material' },
  { command: 'proyecto', description: 'Cambiar obra activa' },
  { command: 'menu', description: 'Menú principal' },
  { command: 'ayuda', description: 'Ver todos los comandos' },
  { command: 'estado', description: 'Ver modo activo' },
  { command: 'cancelar', description: 'Cancelar y volver al menú' },
];

export const TELEGRAM_ALLOWED_UPDATES = ['message', 'callback_query'] as const;
