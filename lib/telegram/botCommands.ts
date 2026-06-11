/** Comandos publicados en el menú de Telegram (setMyCommands). */

export const TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM = 'COMPRAS Y ABASTECIMIENTO';

/** Bloque Compras y abastecimiento (orden del menú / y del picker nativo). */
export const TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO: Array<{
  command: string;
  description: string;
}> = [
  { command: 'procura', description: 'Solicitar material (procura de abastecimiento)' },
  { command: 'facturas', description: 'Foto/PDF factura → Contabilidad + precarga almacén' },
  { command: 'compras', description: 'Compras e inventario por obra (ej. /compras Flamboyant)' },
  { command: 'comprasdia', description: 'Materiales comprados hoy' },
  { command: 'comprassemana', description: 'Materiales comprados esta semana' },
  { command: 'comprasmes', description: 'Materiales comprados este mes' },
];

export const TELEGRAM_BOT_COMMANDS: Array<{ command: string; description: string }> = [
  // — Navegación —
  { command: 'menu', description: 'Menú principal de Casa Inteligente' },
  { command: 'ayuda', description: 'Lista completa de comandos' },
  // — Compras y abastecimiento —
  ...TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO,
  // — Ingresos almacén —
  { command: 'ingreso', description: 'Menú ingreso: factura, nota, sin nota, precargadas' },
  { command: 'recepcion', description: 'Recepción web sincronizada con Telegram' },
  { command: 'ingresosinnota', description: 'Atajo: ingreso sin nota (obra → almacén → material)' },
  { command: 'liberar', description: 'Depositario: tránsito → almacén (cuarentena)' },
  // — Salidas almacén —
  { command: 'salida', description: 'Menú salidas: obra, almacén o préstamo/traspaso' },
  { command: 'salidaalmacen', description: 'Atajo: despacho desde almacén de obra' },
  { command: 'traspaso', description: 'Traspaso o préstamo entre almacenes u obras' },
  // — Campo y obra —
  { command: 'obra', description: 'Elegir obra y subir fotos de evidencia' },
  { command: 'proyecto', description: 'Cambiar obra activa (lista)' },
  { command: 'gasto', description: 'Comprobante de gasto de obra (foto)' },
  { command: 'bitacora', description: 'Bitácora de obra por nota de voz' },
  { command: 'avance', description: 'Reporte numérico diario por partida' },
  { command: 'memoria', description: 'Memoria descriptiva: foto por partida' },
  { command: 'agua', description: 'Registro agua: camión, PPM y litros' },
  // — Consultas —
  { command: 'stock', description: 'Stock guiado o por obra/material' },
  // — Sesión —
  { command: 'estado', description: 'Ver modo y obra activos' },
  { command: 'cancelar', description: 'Cancelar flujo y volver al menú' },
];

export const TELEGRAM_ALLOWED_UPDATES = ['message', 'callback_query'] as const;

function lineasComprasMenuTelegram(): string {
  return TELEGRAM_COMANDOS_COMPRAS_ABASTECIMIENTO.map((c) => {
    const hint =
      c.command === 'procura'
        ? 'solicitar material (ticket PR-…)'
        : c.command === 'facturas'
          ? 'foto/PDF → Contabilidad + precarga almacén'
          : c.command === 'compras'
            ? 'compras e inventario por obra (ej. /compras Flamboyant)'
            : c.command === 'comprasdia'
              ? 'materiales comprados hoy'
              : c.command === 'comprassemana'
                ? 'materiales comprados esta semana'
                : 'materiales comprados este mes';
    return `• /${c.command} — ${hint}`;
  }).join('\n');
}

/** Texto HTML de /menu y /ayuda (una sola fuente para no divergir del menú nativo). */
export const MENSAJE_MENU_TELEGRAM =
  '🏠 <b>Casa Inteligente</b>\n\n' +
  `<b>${TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM}</b>\n` +
  `${lineasComprasMenuTelegram()}\n\n` +
  '<b>Ingresos almacén</b>\n' +
  '• /ingreso — manual · automático · nota · sin nota · precargadas\n' +
  '• /recepcion — pantalla web sincronizada\n' +
  '• /ingresosinnota — atajo ingreso sin nota\n' +
  '• /liberar — depositario: tránsito → almacén\n\n' +
  '<b>Salidas</b>\n' +
  '• /salida — menú (obra · almacén · traspaso)\n' +
  '• /salidaalmacen · /traspaso — atajos\n\n' +
  '<b>Campo y obra</b>\n' +
  '• /obra · /proyecto — evidencia fotográfica\n' +
  '• /gasto — comprobante · /bitacora — nota de voz\n' +
  '• /avance — cantidad por partida · /memoria — foto por partida\n' +
  '• /agua — camión, PPM, litros\n\n' +
  '<b>Consultas</b>\n' +
  '• /stock — guiado (entidad → obra → almacén)\n' +
  '• /stock &lt;obra&gt; o /stock &lt;material&gt;\n\n' +
  '• /estado — contexto activo · /cancelar — volver al menú';

export const MENSAJE_AYUDA_TELEGRAM =
  '<b>Comandos Casa Inteligente</b>\n\n' +
  `<b>${TITULO_COMPRAS_ABASTECIMIENTO_TELEGRAM}</b>\n` +
  '/procura /facturas /compras /comprasdia /comprassemana /comprasmes\n\n' +
  '<b>Ingresos</b>: /ingreso /recepcion /ingresosinnota /liberar\n' +
  '<b>Salidas</b>: /salida /salidaalmacen /traspaso\n' +
  '<b>Campo</b>: /obra /proyecto /gasto /bitacora /avance /memoria /agua\n' +
  '<b>Stock</b>: /stock · /stock rancho flamboyant · /stock cemento\n\n' +
  '<b>Atajos</b> (sin menú): /nota /entrada /emergencia /ingresofactura /egreso /cuarentena\n\n' +
  '/menu — menú · /estado — sesión · /cancelar — reiniciar';
