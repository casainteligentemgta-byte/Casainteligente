/**
 * Comandos del menú de Telegram (BotFather / setMyCommands).
 * Mantener sincronizado con lib/telegram/botCommands.ts
 */
export const TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO = [
  { command: 'procura', description: 'Solicitar material (procura de abastecimiento)' },
  { command: 'facturas', description: 'Foto/PDF factura → Contabilidad + precarga almacén' },
  { command: 'compras', description: 'Compras e inventario por obra (ej. /compras Flamboyant)' },
  { command: 'comprasdia', description: 'Materiales comprados hoy' },
  { command: 'comprassemana', description: 'Materiales comprados esta semana' },
  { command: 'comprasmes', description: 'Materiales comprados este mes' },
];

export const TELEGRAM_BOT_COMMANDS = [
  { command: 'menu', description: 'Menú principal de Casa Inteligente' },
  { command: 'ayuda', description: 'Lista completa de comandos' },
  ...TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO,
  { command: 'ingreso', description: 'Menú ingreso: factura, nota, sin nota, precargadas' },
  { command: 'recepcion', description: 'Recepción web sincronizada con Telegram' },
  { command: 'ingresosinnota', description: 'Atajo: ingreso sin nota (obra → almacén → material)' },
  { command: 'liberar', description: 'Depositario: tránsito → almacén (cuarentena)' },
  { command: 'salida', description: 'Menú salidas: obra, almacén o préstamo/traspaso' },
  { command: 'salidaalmacen', description: 'Atajo: despacho desde almacén de obra' },
  { command: 'traspaso', description: 'Traspaso o préstamo entre almacenes u obras' },
  { command: 'obra', description: 'Elegir obra y subir fotos de evidencia' },
  { command: 'proyecto', description: 'Cambiar obra activa (lista)' },
  { command: 'gasto', description: 'Comprobante de gasto de obra (foto)' },
  { command: 'bitacora', description: 'Bitácora de obra por nota de voz' },
  { command: 'avance', description: 'Reporte numérico diario por partida' },
  { command: 'memoria', description: 'Memoria descriptiva: foto por partida' },
  { command: 'agua', description: 'Registro agua: camión, PPM y litros' },
  { command: 'stock', description: 'Stock guiado o por obra/material' },
  { command: 'estado', description: 'Ver modo y obra activos' },
  { command: 'cancelar', description: 'Cancelar flujo y volver al menú' },
];

export const TELEGRAM_ALLOWED_UPDATES = ['message', 'callback_query'];
