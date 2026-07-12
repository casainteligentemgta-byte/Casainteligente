import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import { isTelegramContexto, type TelegramContexto } from '@/lib/telegram/estados';

export type TelegramIntent = {
  contexto?: TelegramContexto;
  proyecto_id?: string | null;
  reply?: string;
};

const SCHEMA_HINT = `Responde SOLO JSON: {"contexto":"menu"|"factura"|"obra"|"gasto_obra"|"esperando_audio_bitacora"|"agenda"|null,"proyecto_id":"uuid o null","reply":"mensaje corto en español o null"}`;

export async function interpretarTextoTelegramGemini(
  texto: string,
  contextoActual: TelegramContexto,
): Promise<TelegramIntent | null> {
  if (!getGeminiApiKey()) return null;

  try {
    const raw = await geminiGenerateText({
      model: GEMINI_PROCUREMENT_DEFAULT_MODEL,
      systemInstruction:
        'Asistente del bot Telegram de Casa Inteligente (construcción, compras, obra). Interpreta mensajes en español y decide si el usuario quiere cambiar de modo.',
      prompt: [
        `Contexto actual del chat: ${contextoActual}.`,
        'Comandos válidos: /menu, /facturas, /ingreso, /salida, /stock, /agua, /bitacora, /procura, /agenda, /cancelar, /ayuda.',
        'Si pide cumpleaños, cita, recordatorio o agenda personal → contexto agenda.',
        'Si pide registro de agua, camión cisterna o prueba de agua → indicar que use /agua (no cambiar contexto).',
        'Si el usuario pide subir factura, facturas, compra o proveedor → contexto factura.',
        'Si pide foto de obra, avance o proyecto → contexto obra (proyecto_id si menciona UUID).',
        'Si pide gasto, egreso o comprobante de obra → contexto gasto_obra.',
        'Si pide bitácora, reporte de voz o nota de voz de obra → contexto esperando_audio_bitacora.',
        'Si saluda o pide menú → contexto menu.',
        SCHEMA_HINT,
        '',
        `Mensaje del usuario: ${texto}`,
      ].join('\n'),
      temperature: 0.1,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(raw) as TelegramIntent;
    if (parsed.contexto && !isTelegramContexto(parsed.contexto)) {
      parsed.contexto = undefined;
    }
    return parsed;
  } catch (err) {
    console.warn('[telegram/geminiIntent]', err);
    return null;
  }
}
