/**
 * Comandos del menú de Telegram (BotFather / setMyCommands).
 * Mantener sincronizado con lib/telegram/botCommands.ts
 */
export const TELEGRAM_BOT_COMMANDS = [
  { command: 'facturas', description: 'Comprador: foto/PDF → Contabilidad + precarga' },
  { command: 'agua', description: 'Foto camión (placa) + prueba de agua' },
  { command: 'ingreso', description: 'Ingreso almacén: manual/auto factura, nota, sin nota' },
  { command: 'ingresosinnota', description: 'Ingreso sin nota: obra, almacén, materiales' },
  { command: 'compras', description: 'Total compras e inventario por obra (ej. /compras Flamboyant)' },
  { command: 'comprasdia', description: 'Materiales comprados hoy (app y Telegram)' },
  { command: 'comprassemana', description: 'Materiales comprados esta semana' },
  { command: 'comprasmes', description: 'Materiales comprados este mes' },
  { command: 'liberar', description: 'Confirmar recepción física (tránsito → almacén)' },
  { command: 'salida', description: 'Menú salidas: obra, almacén o préstamo' },
  { command: 'salidaalmacen', description: 'Salida almacén: obrero, destino, stock, foto' },
  { command: 'traspaso', description: 'Traspaso o préstamo entre almacenes u obras' },
  { command: 'memoria', description: 'Memoria descriptiva: foto de avance por partida' },
  { command: 'obra', description: 'Elegir obra y subir fotos de evidencia' },
  { command: 'gasto', description: 'Comprobante de gasto de obra' },
  { command: 'bitacora', description: 'Bitácora por nota de voz' },
  { command: 'stock', description: 'Stock: almacén, obra o total por proyecto' },
  { command: 'proyecto', description: 'Cambiar obra activa' },
  { command: 'menu', description: 'Menú principal' },
  { command: 'ayuda', description: 'Ver todos los comandos' },
  { command: 'estado', description: 'Ver modo activo' },
  { command: 'cancelar', description: 'Cancelar y volver al menú' },
];

export const TELEGRAM_ALLOWED_UPDATES = ['message', 'callback_query'];
