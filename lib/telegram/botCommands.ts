/** Comandos publicados en el menú de Telegram (setMyCommands). */

export const TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM = 'COMPRAS Y ABASTECIMIENTO';

/** Bloque Compras y abastecimiento (orden del menú / y del picker nativo). */
export const TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO: Array<{
  command: string;
  description: string;
}> = [
  { command: 'procura', description: 'Solicitar material (procura de abastecimiento)' },
  { command: 'facturas', description: 'Foto o carga manual → Contabilidad + precarga almacén' },
];

export const TELEGRAM_BOT_COMMANDS: Array<{ command: string; description: string }> = [
  { command: 'menu', description: 'Menú principal de Casa Inteligente' },
  { command: 'ayuda', description: 'Lista completa de comandos' },
  ...TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO,
  { command: 'agenda', description: 'Cumpleaños, citas y recordatorios (IA)' },
  { command: 'tecnico', description: 'Técnico de cámaras y redes (IA): /tecnico <pregunta>' },
  { command: 'ingreso', description: 'Menú ingreso: factura, nota, sin nota, precargadas' },
  { command: 'salida', description: 'Menú salida: obrero en obra, despacho o traspaso' },
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
        : 'foto o manual → Contabilidad + precarga almacén';
    return `• /${c.command} — ${hint}`;
  }).join('\n');
}

/**
 * Comandos que ve y puede usar un depositario: solo facturas, ingreso y salida (más menú,
 * ayuda y cancelar). Sin procura, campo, consultas, agenda ni técnico.
 */
export const COMANDOS_DEPOSITARIO_PERMITIDOS = new Set([
  'menu',
  'ayuda',
  'facturas',
  'ingreso',
  'salida',
  'cancelar',
]);

/** Menú nativo de Telegram (setMyCommands) para un depositario. */
export const TELEGRAM_BOT_COMMANDS_DEPOSITARIO: Array<{ command: string; description: string }> =
  TELEGRAM_BOT_COMMANDS.filter((c) => COMANDOS_DEPOSITARIO_PERMITIDOS.has(c.command));

export const MENSAJE_NO_DISPONIBLE_DEPOSITARIO =
  '⛔ Esa función no está disponible para el depositario. Use /ingreso, /salida o /facturas.';

/**
 * Texto HTML de /menu (una sola fuente para no divergir del menú nativo).
 * Para un depositario se omite la sección de procuras.
 */
export function mensajeMenuTelegram(opts?: { depositario?: boolean }): string {
  if (opts?.depositario) {
    return (
      '🏠 <b>Casa Inteligente</b>\n\n' +
      '<b>Facturas</b>\n• /facturas — facturas precargadas por el comprador\n\n' +
      '<b>Ingresos almacén</b>\n' +
      '• /ingreso — manual · automático · nota · sin nota · precargadas\n\n' +
      '<b>Salidas</b>\n' +
      '• /salida — obrero en obra · despacho · traspaso\n\n' +
      '• /cancelar — volver al menú'
    );
  }
  const compras = `<b>${TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM}</b>\n${lineasComprasMenuTelegram()}\n\n`;
  return (
    '🏠 <b>Casa Inteligente</b>\n\n' +
    compras +
    '<b>Ingresos almacén</b>\n' +
    '• /ingreso — manual · automático · nota · sin nota · precargadas\n\n' +
    '<b>Salidas</b>\n' +
    '• /salida — obrero en obra · despacho · traspaso\n\n' +
    '<b>Campo</b>\n' +
    '• /bitacora — nota de voz · /agua — camión, PPM, litros\n\n' +
    '<b>Consultas</b>\n' +
    '• /stock — guiado (entidad → obra → almacén)\n' +
    '• /stock &lt;obra&gt; o /stock &lt;material&gt;\n\n' +
    '<b>Agenda personal</b>\n' +
    '• /agenda — guardar o consultar fechas especiales (IA)\n' +
    '• /limpiar_agenda — borrar historial del chat\n\n' +
    '<b>Técnico de dispositivos</b>\n' +
    '• /tecnico &lt;pregunta&gt; — cámaras, grabadores, PoE y redes (IA)\n\n' +
    '• /cancelar — volver al menú'
  );
}

/** Texto HTML de /ayuda. Para un depositario se omite la procura. */
export function mensajeAyudaTelegram(opts?: { depositario?: boolean }): string {
  if (opts?.depositario) {
    return (
      '<b>Comandos Casa Inteligente</b>\n\n' +
      '<b>Facturas</b>: /facturas\n' +
      '<b>Ingresos</b>: /ingreso\n' +
      '<b>Salidas</b>: /salida\n\n' +
      '/menu — menú · /cancelar — reiniciar'
    );
  }
  const compras = `<b>${TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM}</b>\n/procura /facturas\n\n`;
  return (
    '<b>Comandos Casa Inteligente</b>\n\n' +
    compras +
    '<b>Ingresos</b>: /ingreso\n' +
    '<b>Salidas</b>: /salida\n' +
    '<b>Campo</b>: /bitacora /agua\n' +
    '<b>Agenda</b>: /agenda /limpiar_agenda\n' +
    '<b>Técnico IA</b>: /tecnico ¿cuántos W consume la H9c?\n' +
    '<b>Stock</b>: /stock · /stock rancho flamboyant · /stock cemento\n\n' +
    '<b>Atajos</b> (sin menú): /nota /entrada /emergencia /ingresofactura /egreso\n\n' +
    '/menu — menú · /cancelar — reiniciar'
  );
}

export const MENSAJE_MENU_TELEGRAM = mensajeMenuTelegram();
export const MENSAJE_AYUDA_TELEGRAM = mensajeAyudaTelegram();

export const MENSAJE_PROCURA_SOLO_NO_DEPOSITARIO =
  '⛔ Los depositarios no piden procuras. Usa /ingreso, /salida o /stock.';

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
