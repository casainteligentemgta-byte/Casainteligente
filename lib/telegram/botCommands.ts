/** Comandos publicados en el menú de Telegram (setMyCommands). */

export const TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM = 'COMPRAS Y ABASTECIMIENTO';

/** Bloque Compras y abastecimiento (orden del menú / y del picker nativo). */
export const TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO: Array<{
  command: string;
  description: string;
}> = [
  { command: 'procura', description: 'Solicitar material (procura de abastecimiento)' },
  { command: 'facturas', description: 'Foto/PDF factura → Contabilidad + precarga almacén' },
];

export const TELEGRAM_BOT_COMMANDS: Array<{ command: string; description: string }> = [
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

export const TELEGRAM_ALLOWED_UPDATES = ['message', 'callback_query'] as const;

function lineasComprasMenuTelegram(): string {
  return TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO.map((c) => {
    const hint =
      c.command === 'procura'
        ? 'solicitar material (ticket PR-…)'
        : 'foto/PDF → Contabilidad + precarga almacén';
    return `• /${c.command} — ${hint}`;
  }).join('\n');
}

/** Texto HTML de /menu y /ayuda (una sola fuente para no divergir del menú nativo). */
export const MENSAJE_MENU_TELEGRAM =
  '🏠 <b>Casa Inteligente</b>\n\n' +
  `<b>${TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM}</b>\n` +
  `${lineasComprasMenuTelegram()}\n\n` +
  '<b>Ingresos almacén</b>\n' +
  '• /ingreso — manual · automático · nota · sin nota · precargadas\n\n' +
  '<b>Salidas</b>\n' +
  '• /salida — obra · almacén · traspaso\n\n' +
  '<b>Campo</b>\n' +
  '• /bitacora — nota de voz · /agua — camión, PPM, litros\n\n' +
  '<b>Consultas</b>\n' +
  '• /stock — guiado (entidad → obra → almacén)\n' +
  '• /stock &lt;obra&gt; o /stock &lt;material&gt;\n\n' +
  '• /cancelar — volver al menú';

export const MENSAJE_AYUDA_TELEGRAM =
  '<b>Comandos Casa Inteligente</b>\n\n' +
  `<b>${TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM}</b>\n` +
  '/procura /facturas\n\n' +
  '<b>Ingresos</b>: /ingreso\n' +
  '<b>Salidas</b>: /salida\n' +
  '<b>Campo</b>: /bitacora /agua\n' +
  '<b>Stock</b>: /stock · /stock rancho flamboyant · /stock cemento\n\n' +
  '<b>Atajos</b> (sin menú): /nota /entrada /emergencia /ingresofactura /egreso\n\n' +
  '/menu — menú · /cancelar — reiniciar';

/** Comandos retirados del menú (responden con aviso, no ejecutan flujo). */
export const TELEGRAM_COMANDOS_RETIRADOS = new Set([
  'compras',
  'comprasdia',
  'comprassemana',
  'comprasmes',
  'recepcion',
  'ingresosinnota',
  'liberar',
  'salidaalmacen',
  'salidaobra',
  'despacho',
  'traspaso',
  'obra',
  'proyecto',
  'gasto',
  'avance',
  'memoria',
  'estado',
]);

export const MENSAJE_COMANDO_RETIRADO_TELEGRAM =
  '⚠️ Este comando ya no está en el bot.\nUsa /menu o /ingreso · /salida · /stock según lo que necesites.';
