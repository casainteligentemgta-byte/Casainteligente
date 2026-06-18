/**
 * Comandos del menú de Telegram (BotFather / setMyCommands).
 * Mantener sincronizado con lib/telegram/botCommands.ts
 */
export const TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO = [
  { command: 'procura', description: 'Solicitar material (procura de abastecimiento)' },
  { command: 'facturas', description: 'Foto/PDF factura → Contabilidad + precarga almacén' },
];

export const TELEGRAM_BOT_COMMANDS = [
  { command: 'menu', description: 'Menú principal de Casa Inteligente' },
  { command: 'ayuda', description: 'Lista completa de comandos' },
  ...TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO,
  { command: 'ingreso', description: 'Menú ingreso: factura, nota, sin nota, precargadas' },
  { command: 'salida', description: 'Menú salidas: obra, almacén o préstamo/traspaso' },
  { command: 'bitacora', description: 'Bitácora de obra por nota de voz' },
  { command: 'agua', description: 'Registro agua: camión, PPM y litros' },
  { command: 'stock', description: 'Stock guiado o por obra/material' },
  { command: 'cancelar', description: 'Cancelar flujo y volver al menú' },
];

export const TELEGRAM_ALLOWED_UPDATES = ['message', 'callback_query'];
