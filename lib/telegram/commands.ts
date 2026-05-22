import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import type { TelegramContexto } from '@/lib/telegram/estados';

export type ComandoTelegramResult = {
  handled: boolean;
  contexto?: TelegramContexto;
  proyectoId?: string | null;
  mensaje?: string;
  resetProyecto?: boolean;
};

export function procesarComandoTelegram(texto: string): ComandoTelegramResult {
  const t = texto.trim();
  const lower = t.toLowerCase();
  const parts = t.split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? '';

  if (cmd === '/start' || cmd === '/menu' || cmd === '/inicio') {
    return {
      handled: true,
      contexto: 'menu',
      proyectoId: null,
      resetProyecto: true,
      mensaje:
        '🏠 <b>Casa Inteligente</b>\n\n' +
        'Elige un modo:\n' +
        '• /factura — subir factura de compra (IA + confirmación web)\n' +
        '• /obra &lt;uuid&gt; — fotos de evidencia en el proyecto\n' +
        '• /gasto — comprobante de gasto de obra (requiere /obra antes)\n' +
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
      mensaje: '↩️ Volviste al menú. Usa /factura, /obra o /gasto.',
    };
  }

  if (cmd === '/factura' || lower === 'factura') {
    return {
      handled: true,
      contexto: 'factura',
      mensaje:
        '📄 Modo <b>factura</b>. Envía una foto o PDF de la factura de compra.\n' +
        'Se analizará con Gemini y quedará pendiente en la web.',
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

  if (cmd === '/estado') {
    return { handled: true, mensaje: '__ESTADO__' };
  }

  return { handled: false };
}
