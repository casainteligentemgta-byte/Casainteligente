/** Comandos publicados en el menú de Telegram (setMyCommands). */
export const TELEGRAM_BOT_COMMANDS: Array<{ command: string; description: string }> = [
  { command: 'facturas', description: 'Recibir factura de compra (foto/PDF)' },
  { command: 'agua', description: 'Foto camión (placa) + prueba de agua' },
  { command: 'ingresonotas', description: 'Nota de entrega: proyecto, almacén, proveedor, stock' },
  { command: 'nota', description: 'Alias de /ingresonotas (nota de entrega)' },
  {
    command: 'ingresoemergencia',
    description: 'Emergencia sin papeles: proyecto, almacén, stock',
  },
  { command: 'emergencia', description: 'Alias de /ingresoemergencia (sin factura)' },
  { command: 'ingresomanual', description: 'Ingreso manual (mismo flujo que /nota)' },
  { command: 'ingresofactura', description: 'Proveedor → factura → cantidades → fotos → almacén' },
  { command: 'compras', description: 'Total compras e inventario por obra (ej. /compras Flamboyant)' },
  { command: 'comprasdia', description: 'Materiales comprados hoy (app y Telegram)' },
  { command: 'comprassemana', description: 'Materiales comprados esta semana' },
  { command: 'comprasmes', description: 'Materiales comprados este mes' },
  { command: 'liberar', description: 'Liberar material de cuarentena (depositario)' },
  { command: 'salidaalmacen', description: 'Salida almacén: obrero, destino, stock, foto' },
  { command: 'salida', description: 'Egreso completo (obrero, partida, foto)' },
  { command: 'traspaso', description: 'Traspaso o préstamo entre almacenes u obras' },
  { command: 'memoria', description: 'Memoria descriptiva: foto de avance por partida' },
  { command: 'obra', description: 'Elegir obra y subir fotos de evidencia' },
  { command: 'gasto', description: 'Comprobante de gasto de obra' },
  { command: 'bitacora', description: 'Bitácora por nota de voz' },
  { command: 'stock', description: 'Stock por entidad, obra y almacén' },
  { command: 'proyecto', description: 'Cambiar obra activa' },
  { command: 'menu', description: 'Menú principal' },
  { command: 'ayuda', description: 'Ver todos los comandos' },
  { command: 'estado', description: 'Ver modo activo' },
  { command: 'cancelar', description: 'Cancelar y volver al menú' },
];

export const TELEGRAM_ALLOWED_UPDATES = ['message', 'callback_query'] as const;
