import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import type { TelegramContexto } from '@/lib/telegram/estados';
import type { ProyectoPickerModo } from '@/lib/telegram/proyectoPicker';
import { mensajeModoFacturasActivado } from '@/lib/telegram/mensajesFactura';
import type { PeriodoComprasTelegram } from '@/lib/telegram/comprasPeriodoTelegram';
import { esComandoAgua, primerTokenComando } from '@/lib/telegram/parseComandoTelegram';

export type ComandoTelegramResult = {
  handled: boolean;
  contexto?: TelegramContexto;
  proyectoId?: string | null;
  mensaje?: string;
  resetProyecto?: boolean;
  /** Palabra clave tras /stock (obra o material). */
  stockKeyword?: string;
  /** Consulta guiada: entidad → obra → almacén → stock. */
  comandoStockConsulta?: boolean;
  /** Muestra lista desplegable (inline keyboard) de proyectos. */
  mostrarPickerProyecto?: ProyectoPickerModo;
  /** Inicia flujo /agua (picker de obras activas). */
  comandoAgua?: boolean;
  /** Ingreso manual a almacén (obra → almacén → materiales). */
  comandoIngresoManual?: boolean;
  comandoSalida?: boolean;
  /** Facturas precargadas (Telegram + app) pendientes de ingreso a almacén. */
  comandoIngresoFactura?: boolean;
  /** Nota de entrega: obra → almacén → proveedor → materiales → stock. */
  comandoNotaEntrega?: boolean;
  /** Ingreso emergencia: mismo flujo, tipo emergencia en recepción de campo. */
  comandoEmergencia?: boolean;
  /** Despacho desde almacén: obra → almacén → observaciones → stock → cantidades. */
  comandoSalidaObra?: boolean;
  /** Lista materiales comprados en el día, semana o mes (app + Telegram). */
  comandoComprasPeriodo?: PeriodoComprasTelegram;
  /** Lista material en cuarentena para liberar (depositario). */
  comandoLiberarCuarentena?: boolean;
  /** Traspaso / préstamo entre ubicaciones de inventario. */
  comandoTraspaso?: boolean;
  /** Resumen compras + stock por obra: /compras &lt;nombre obra&gt; */
  comandoComprasObra?: string;
};

export function procesarComandoTelegram(texto: string): ComandoTelegramResult {
  const t = texto.trim();
  const lower = t.toLowerCase();
  const parts = t.split(/\s+/);
  const cmd = primerTokenComando(t);

  if (cmd === '/start' || cmd === '/menu' || cmd === '/inicio') {
    return {
      handled: true,
      contexto: 'menu',
      proyectoId: null,
      resetProyecto: true,
      mensaje:
        '🏠 <b>Casa Inteligente</b>\n\n' +
        'Elige un modo:\n' +
        '• /facturas — recibir factura de compra (foto/PDF, IA + app)\n' +
        '• /obra — elegir obra y subir fotos de evidencia\n' +
        '• /proyecto — cambiar obra activa (lista)\n' +
        '• /gasto — comprobante de gasto de obra\n' +
        '• /stock — inventario por entidad, obra y almacén\n' +
        '• /stock &lt;producto&gt; — búsqueda rápida por nombre\n' +
        '• /bitacora — reporte de obra por nota de voz\n' +
        '• /agua — obra → camión → PPM (azul) → litros\n' +
        '• /nota — nota de entrega: obra, almacén, proveedor, artículos, fotos, stock\n' +
        '• /emergencia — ingreso urgente (mismo flujo, tipo emergencia)\n' +
        '• /ingresomanual — alias ingreso manual (mismo flujo que /nota)\n' +
        '• /ingresofactura — proveedor → factura → verificar cantidades → fotos → almacén\n' +
        '• /compras &lt;obra&gt; — total gastado e inventario en almacenes de la obra\n' +
        '• /comprasdia — materiales comprados hoy (app y Telegram)\n' +
        '• /comprassemana — materiales de la semana en curso\n' +
        '• /comprasmes — materiales del mes en curso\n' +
        '• /liberar — material en cuarentena: aprobar y sumar stock\n' +
        '• /salidaalmacen — salida: obra, almacén, obrero, destino, stock, foto\n' +
        '• /salida — egreso con obrero, partida y foto (flujo completo)\n' +
        '• /traspaso — mover stock entre almacenes u obras\n' +
        '• /avance — reporte numérico diario de partida\n' +
        '• /memoria — memoria descriptiva: foto de avance por partida\n' +
        '• /estado — ver modo activo\n' +
        '• /cancelar — volver al menú',
    };
  }

  if (cmd === '/ayuda' || cmd === '/help') {
    return {
      handled: true,
      mensaje:
        '<b>Comandos</b>\n' +
        '/facturas — modo facturas de compra\n' +
        '/obra — elegir obra (lista) y subir fotos\n' +
        '/proyecto — cambiar obra activa\n' +
        '/gasto — registrar comprobante de gasto\n' +
        '/stock — listar stock (entidad → obra → almacén)\n' +
        '/stock cemento — búsqueda rápida por nombre\n' +
        '/bitacora — enviar nota de voz de bitácora (tras /obra)\n' +
        '/agua — obra, camión, prueba PPM, litros\n' +
        '/nota — nota de entrega (obra → almacén → proveedor → artículos → stock)\n' +
        '/emergencia — ingreso en emergencia (mismo flujo, actualiza stock)\n' +
        '/ingresomanual — ingreso manual (mismo flujo estructurado)\n' +
        '/ingresofactura — proveedor, factura, conteo físico, fotos e ingreso a almacén\n' +
        '/compras Flamboyant — total compras e stock en almacenes de la obra\n' +
        '/comprasdia — lista de materiales comprados hoy\n' +
        '/comprassemana — materiales comprados esta semana\n' +
        '/comprasmes — materiales comprados este mes\n' +
        '/liberar — liberar material de cuarentena (depositario)\n' +
        '/salidaalmacen — salida almacén (obrero, obra/almacén destino, stock, foto)\n' +
        '/salida — egreso con obrero, partida presupuestaria y foto\n' +
        '/traspaso — traspaso o préstamo entre ubicaciones (origen → destino)\n' +
        '/memoria — foto de avance vinculada a partida (memoria descriptiva)\n' +
        '/menu — menú principal\n' +
        '/cancelar — cancelar y limpiar proyecto\n' +
        '/estado — contexto actual',
    };
  }

  if (cmd === '/cancelar') {
    return {
      handled: true,
      contexto: 'menu',
      proyectoId: null,
      resetProyecto: true,
      mensaje: '↩️ Volviste al menú. Usa /facturas, /obra, /ingresomanual, /salida o /agua.',
    };
  }

  if (cmd === '/factura' || cmd === '/facturas' || lower === 'factura' || lower === 'facturas') {
    return {
      handled: true,
      contexto: 'factura',
      mensaje: mensajeModoFacturasActivado(),
    };
  }

  if (cmd === '/obra' || cmd === '/proyecto') {
    const uuid = parts[1]?.trim();
    if (uuid) {
      if (!isValidProyectoUuid(uuid)) {
        return { handled: true, mensaje: '❌ UUID de proyecto inválido.' };
      }
      return {
        handled: true,
        contexto: 'obra',
        proyectoId: uuid,
        mensaje: `🏗 Obra vinculada (<code>${uuid.slice(0, 8)}…</code>).\nEnvía fotos o usa /gasto /bitacora.`,
      };
    }
    return {
      handled: true,
      mostrarPickerProyecto: 'obra',
      mensaje: '🏗 <b>Selecciona tu obra</b> en la lista de abajo:',
    };
  }

  if (cmd === '/gasto') {
    return {
      handled: true,
      contexto: 'gasto_obra',
      mostrarPickerProyecto: 'gasto_obra',
      mensaje:
        '💸 Modo <b>gasto de obra</b>.\n' +
        'Elige la obra abajo (si aún no hay una activa) y envía foto del comprobante.',
    };
  }

  if (esComandoAgua(t)) {
    return { handled: true, comandoAgua: true };
  }

  if (cmd === '/nota' || cmd === '/notaentrega' || cmd === '/entrada') {
    return { handled: true, comandoNotaEntrega: true };
  }

  if (cmd === '/emergencia' || cmd === '/urgente') {
    return { handled: true, comandoEmergencia: true };
  }

  if (cmd === '/ingresomanual') {
    return { handled: true, comandoIngresoManual: true };
  }

  if (cmd === '/ingresofactura' || cmd === '/ingresofacturas' || cmd === '/ingreso') {
    return { handled: true, comandoIngresoFactura: true };
  }

  if (cmd === '/comprasdia') {
    return { handled: true, comandoComprasPeriodo: 'dia' };
  }
  if (cmd === '/comprassemana') {
    return { handled: true, comandoComprasPeriodo: 'semana' };
  }
  if (cmd === '/comprasmes') {
    return { handled: true, comandoComprasPeriodo: 'mes' };
  }

  if (cmd === '/compras') {
    const obra = parts.slice(1).join(' ').trim();
    return { handled: true, comandoComprasObra: obra };
  }

  if (cmd === '/liberar' || cmd === '/cuarentena') {
    return { handled: true, comandoLiberarCuarentena: true };
  }

  if (cmd === '/salidaalmacen' || cmd === '/salidaobra' || cmd === '/despacho') {
    return { handled: true, comandoSalidaObra: true };
  }

  if (cmd === '/salida') {
    return { handled: true, comandoSalida: true };
  }

  if (cmd === '/traspaso') {
    return { handled: true, comandoTraspaso: true };
  }

  if (cmd === '/memoria') {
    return {
      handled: true,
      contexto: 'memoria_obra',
      mostrarPickerProyecto: 'memoria_obra',
      mensaje:
        '📸 <b>Memoria descriptiva de avance</b>\n\n' +
        'Documenta el avance físico con fotos vinculadas a cada partida del presupuesto.\n' +
        'Elige la obra abajo → partida → envía la foto.',
    };
  }

  if (cmd === '/bitacora') {
    return {
      handled: true,
      contexto: 'esperando_audio_bitacora',
      mostrarPickerProyecto: 'esperando_audio_bitacora',
      mensaje:
        '📋 <b>Bitácora de obra</b>\n\n' +
        'Elige la obra abajo y envía una <b>nota de voz</b> con avances y novedades.\n' +
        'Gemini transcribirá y guardará el reporte.',
    };
  }

  if (cmd === '/estado') {
    return { handled: true, mensaje: '__ESTADO__' };
  }

  if (cmd === '/stock') {
    const keyword = parts.slice(1).join(' ').trim();
    if (!keyword) {
      return { handled: true, comandoStockConsulta: true };
    }
    return { handled: true, stockKeyword: keyword };
  }

  return { handled: false };
}
