import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import type { TelegramContexto } from '@/lib/telegram/estados';
import { mensajeModoFacturasActivado } from '@/lib/telegram/mensajesFactura';

export type ComandoTelegramResult = {
  handled: boolean;
  contexto?: TelegramContexto;
  proyectoId?: string | null;
  mensaje?: string;
  resetProyecto?: boolean;
  /** Palabra clave tras /stock (consulta inventario). */
  stockKeyword?: string;
};

export function procesarComandoTelegram(texto: string): ComandoTelegramResult {
  const t = texto.trim();
  const lower = t.toLowerCase();
  const parts = t.split(/\s+/);
  const cmdRaw = parts[0]?.toLowerCase() ?? '';
  const cmd = cmdRaw.split('@')[0];

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
        '• /obra &lt;uuid&gt; — fotos de evidencia en el proyecto\n' +
        '• /gasto — comprobante de gasto de obra (requiere /obra antes)\n' +
        '• /stock &lt;producto&gt; — consultar inventario por nombre\n' +
        '• /bitacora — reporte de obra por nota de voz (requiere /obra)\n' +
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
        '/obra &lt;uuid-proyecto&gt; — vincular obra y subir fotos\n' +
        '/gasto — registrar comprobante de gasto\n' +
        '/stock cemento — buscar stock por nombre (parcial)\n' +
        '/bitacora — enviar nota de voz de bitácora (tras /obra)\n' +
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
      mensaje: '↩️ Volviste al menú. Usa /facturas, /obra o /gasto.',
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

  if (cmd === '/obra') {
    const uuid = parts[1]?.trim();
    if (!uuid) {
      return {
        handled: true,
        mensaje:
          '⚠️ Indica el UUID del proyecto:\n<code>/obra 171694ed-0ecb-4ec5-82f5-82b980cb261f</code>',
      };
    }
    if (!isValidProyectoUuid(uuid)) {
      return { handled: true, mensaje: '❌ UUID de proyecto inválido.' };
    }
    return {
      handled: true,
      contexto: 'obra',
      proyectoId: uuid,
      mensaje: `🏗 Modo <b>obra</b> — proyecto <code>${uuid.slice(0, 8)}…</code>\nEnvía fotos (avance, planos, evidencia).`,
    };
  }

  if (cmd === '/gasto') {
    return {
      handled: true,
      contexto: 'gasto_obra',
      mensaje:
        '💸 Modo <b>gasto de obra</b>. Primero usa /obra &lt;uuid&gt; si no hay proyecto.\n' +
        'Envía foto del comprobante; Gemini extraerá monto y proveedor.',
    };
  }

  if (cmd === '/bitacora') {
    return {
      handled: true,
      contexto: 'esperando_audio_bitacora',
      mensaje:
        '📋 <b>Bitácora de obra</b>\n\n' +
        'Graba y envía una <b>nota de voz</b> con avances, novedades y personal en frente.\n' +
        'Debes tener proyecto activo (<code>/obra &lt;uuid&gt;</code>).\n\n' +
        'Gemini transcribirá y guardará el reporte en el sistema.',
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
