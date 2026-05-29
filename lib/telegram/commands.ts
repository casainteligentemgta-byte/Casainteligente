import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import type { TelegramContexto } from '@/lib/telegram/estados';
import type { ProyectoPickerModo } from '@/lib/telegram/proyectoPicker';
import { mensajeModoFacturasActivado } from '@/lib/telegram/mensajesFactura';
import { esComandoAgua, primerTokenComando } from '@/lib/telegram/parseComandoTelegram';

export type ComandoTelegramResult = {
  handled: boolean;
  contexto?: TelegramContexto;
  proyectoId?: string | null;
  mensaje?: string;
  resetProyecto?: boolean;
  /** Palabra clave tras /stock (consulta inventario). */
  stockKeyword?: string;
  /** Muestra lista desplegable (inline keyboard) de proyectos. */
  mostrarPickerProyecto?: ProyectoPickerModo;
  /** Inicia flujo /agua (picker de obras activas). */
  comandoAgua?: boolean;
  comandoEntrada?: boolean;
  comandoSalida?: boolean;
  /** Lista compras ya registradas pendientes de ingreso físico a almacén. */
  comandoIngresoAlmacen?: boolean;
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
        '• /facturas — recibir factura de compra (IA + app)\n' +
        '• /factura — igual que /facturas\n' +
        '• /obra — elegir obra y subir fotos de evidencia\n' +
        '• /proyecto — cambiar obra activa (lista)\n' +
        '• /gasto — comprobante de gasto de obra\n' +
        '• /stock &lt;producto&gt; — consultar inventario por nombre\n' +
        '• /bitacora — reporte de obra por nota de voz\n' +
        '• /agua — obra → camión → PPM (azul) → litros\n' +
        '• /entrada — nota de entrega: proveedor + productos → cola de compras\n' +
        '• /ingreso — facturas ya cargadas pendientes de ingreso a almacén\n' +
        '• /salida — foto + detalle de material que egresa\n' +
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
        '/factura — modo facturas de compra\n' +
        '/obra — elegir obra (lista) y subir fotos\n' +
        '/proyecto — cambiar obra activa\n' +
        '/gasto — registrar comprobante de gasto\n' +
        '/stock cemento — buscar stock por nombre (parcial)\n' +
        '/bitacora — enviar nota de voz de bitácora (tras /obra)\n' +
        '/agua — obra, camión, prueba PPM, litros\n' +
        '/entrada — nota de entrega (depositario → cola de compras)\n' +
        '/ingreso — facturas pendientes de ingreso físico a almacén\n' +
        '/salida — egreso de material (capítulo + foto + almacén origen + stock)\n' +
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
      mensaje: '↩️ Volviste al menú. Usa /facturas, /obra, /entrada, /salida o /agua.',
    };
  }

  if (cmd === '/facturas' || lower === 'facturas') {
    return {
      handled: true,
      contexto: 'factura',
      mensaje: mensajeModoFacturasActivado(),
    };
  }

  if (cmd === '/factura' || lower === 'factura') {
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

  if (cmd === '/entrada' || cmd === '/nota') {
    return { handled: true, comandoEntrada: true };
  }

  if (cmd === '/ingreso') {
    return { handled: true, comandoIngresoAlmacen: true };
  }

  if (cmd === '/salida') {
    return { handled: true, comandoSalida: true };
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
      return {
        handled: true,
        mensaje:
          '🔎 <b>Consulta de inventario</b>\n\n' +
          'Escribe el producto después del comando:\n' +
          '<code>/stock cemento</code>\n' +
          '<code>/stock cable THW</code>',
      };
    }
    return { handled: true, stockKeyword: keyword };
  }

  return { handled: false };
}
