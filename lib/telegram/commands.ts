import type { TelegramContexto } from '@/lib/telegram/estados';
import type { ProyectoPickerModo } from '@/lib/telegram/proyectoPicker';
import { mensajeModoFacturasActivado } from '@/lib/telegram/mensajesFactura';
import { esComandoAgua, primerTokenComando } from '@/lib/telegram/parseComandoTelegram';
import {
  MENSAJE_AYUDA_TELEGRAM,
  MENSAJE_COMANDO_RETIRADO_TELEGRAM,
  MENSAJE_MENU_TELEGRAM,
  TELEGRAM_COMANDOS_RETIRADOS,
} from '@/lib/telegram/botCommands';

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
  /** Submenú /ingreso (manual, facturas, notas, sin notas). */
  comandoMenuIngreso?: boolean;
  /** Facturas precargadas (Telegram + app) pendientes de ingreso a almacén. */
  comandoIngresoFactura?: boolean;
  /** Submenú /salida (obra, almacén, préstamo). */
  comandoMenuSalida?: boolean;
  /** Nota de entrega: obra → almacén → proveedor → materiales → stock. */
  comandoNotaEntrega?: boolean;
  /** Ingreso emergencia: mismo flujo, tipo emergencia en recepción de campo. */
  comandoEmergencia?: boolean;
  /** Solicitud de procura / abastecimiento. */
  comandoProcura?: boolean;
};

export function procesarComandoTelegram(texto: string): ComandoTelegramResult {
  const t = texto.trim();
  const lower = t.toLowerCase();
  const parts = t.split(/\s+/);
  const cmd = primerTokenComando(t);
  const cmdKey = cmd.replace(/^\//, '');

  if (TELEGRAM_COMANDOS_RETIRADOS.has(cmdKey)) {
    return { handled: true, mensaje: MENSAJE_COMANDO_RETIRADO_TELEGRAM };
  }

  if (cmd === '/start' || cmd === '/menu' || cmd === '/inicio') {
    return {
      handled: true,
      contexto: 'menu',
      proyectoId: null,
      resetProyecto: true,
      mensaje: MENSAJE_MENU_TELEGRAM,
    };
  }

  if (cmd === '/ayuda' || cmd === '/help') {
    return {
      handled: true,
      mensaje: MENSAJE_AYUDA_TELEGRAM,
    };
  }

  if (cmd === '/cancelar') {
    return {
      handled: true,
      contexto: 'menu',
      proyectoId: null,
      resetProyecto: true,
      mensaje: '↩️ Volviste al menú. Usa /ingreso, /facturas, /salida, /stock o /agua.',
    };
  }

  if (cmd === '/factura' || cmd === '/facturas' || lower === 'factura' || lower === 'facturas') {
    return {
      handled: true,
      contexto: 'factura',
      mensaje: mensajeModoFacturasActivado(),
    };
  }

  if (cmd === '/procura' || cmd === '/procuras') {
    return { handled: true, comandoProcura: true };
  }

  if (esComandoAgua(t)) {
    return { handled: true, comandoAgua: true };
  }

  if (
    cmd === '/nota' ||
    cmd === '/notaentrega' ||
    cmd === '/entrada' ||
    cmd === '/ingresonotas' ||
    cmd === '/ingresonota'
  ) {
    return { handled: true, comandoNotaEntrega: true };
  }

  if (
    cmd === '/emergencia' ||
    cmd === '/urgente' ||
    cmd === '/ingresoemergencia' ||
    cmd === '/emergencias'
  ) {
    return { handled: true, comandoEmergencia: true };
  }

  if (cmd === '/sinnota' || cmd === '/ingresomanual') {
    return { handled: true, comandoIngresoManual: true };
  }

  if (cmd === '/ingreso') {
    return { handled: true, comandoMenuIngreso: true };
  }

  if (cmd === '/ingresofactura' || cmd === '/ingresofacturas') {
    return { handled: true, comandoIngresoFactura: true };
  }

  if (cmd === '/salida' || cmd === '/salid') {
    return { handled: true, comandoMenuSalida: true };
  }

  if (cmd === '/egreso') {
    return { handled: true, comandoSalida: true };
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

  if (cmd === '/stock') {
    const keyword = parts.slice(1).join(' ').trim();
    if (!keyword) {
      return { handled: true, comandoStockConsulta: true };
    }
    return { handled: true, stockKeyword: keyword };
  }

  return { handled: false };
}
