import {
  geminiGenerateText,
  geminiGenerateWithDocument,
  getGeminiApiKey,
  type GeminiGenerateError,
} from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import {
  PHEME_SYSTEM_INSTRUCTION,
  PHEME_USER_PROMPT_AUDIO,
  PHEME_USER_PROMPT_TEXTO,
} from '@/lib/pheme/identidad';
import { formatearMinutaMarkdown } from '@/lib/pheme/formatearMinutaMarkdown';
import { parseMinutaPhemeJson } from '@/lib/pheme/parseMinuta';
import type { GenerarMinutaPhemeResult, MinutaPheme } from '@/lib/pheme/types';

export { parseMinutaPhemeJson } from '@/lib/pheme/parseMinuta';

function phemeModel(): string {
  return (
    process.env.GEMINI_PHEME_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL
  );
}

function minutaOfflineSinClave(transcripcion: string): GenerarMinutaPhemeResult {
  const preview = transcripcion.trim().slice(0, 280);
  const minuta: MinutaPheme = {
    resumen_ejecutivo:
      'No se pudo generar la minuta con IA: falta GEMINI_API_KEY. Pegue la transcripción de nuevo tras configurar la clave, o use el modo con Gemini en producción.',
    puntos_clave: preview
      ? ['Transcripción recibida (análisis automático no disponible sin Gemini).']
      : [],
    acuerdos: [],
    alertas_pendientes: [
      'Configurar GEMINI_API_KEY en el entorno del servidor para activar Pheme.',
    ],
  };
  return {
    minuta,
    markdown: formatearMinutaMarkdown(minuta),
    desdeGemini: false,
    aviso: 'Modo sin GEMINI_API_KEY — no se llamó a la API.',
  };
}

function wrapResult(minuta: MinutaPheme, modelo: string): GenerarMinutaPhemeResult {
  return {
    minuta,
    markdown: formatearMinutaMarkdown(minuta),
    desdeGemini: true,
    modelo,
  };
}

/**
 * Genera minuta Pheme a partir de texto de transcripción.
 */
export async function generarMinutaDesdeTexto(transcripcion: string): Promise<GenerarMinutaPhemeResult> {
  const texto = (transcripcion ?? '').trim();
  if (!texto) {
    throw Object.assign(new Error('La transcripción está vacía.'), { status: 400 });
  }
  if (texto.length > 120_000) {
    throw Object.assign(new Error('La transcripción supera el límite de 120 000 caracteres.'), {
      status: 400,
    });
  }

  if (!getGeminiApiKey()) {
    return minutaOfflineSinClave(texto);
  }

  const model = phemeModel();
  const prompt = PHEME_USER_PROMPT_TEXTO.replace('{{TRANSCRIPCION}}', texto);

  try {
    const raw = await geminiGenerateText({
      model,
      systemInstruction: PHEME_SYSTEM_INSTRUCTION,
      prompt,
      temperature: 0.25,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    });
    const minuta = parseMinutaPhemeJson(raw);
    if (!minuta) {
      throw Object.assign(new Error('Gemini no devolvió una minuta JSON válida.'), {
        retryable: true,
      });
    }
    return wrapResult(minuta, model);
  } catch (err) {
    const g = err as GeminiGenerateError;
    console.error('[pheme generarMinuta texto]', g);
    throw g;
  }
}

/**
 * Genera minuta Pheme a partir de audio (base64 + mime).
 */
export async function generarMinutaDesdeAudio(opts: {
  base64: string;
  mimeType: string;
}): Promise<GenerarMinutaPhemeResult> {
  const base64 = (opts.base64 ?? '').trim();
  const mimeType = (opts.mimeType ?? '').trim() || 'audio/ogg';
  if (!base64) {
    throw Object.assign(new Error('Audio vacío (base64 requerido).'), { status: 400 });
  }
  if (!getGeminiApiKey()) {
    return minutaOfflineSinClave('');
  }

  const model = phemeModel();
  try {
    const raw = await geminiGenerateWithDocument({
      model,
      prompt: PHEME_USER_PROMPT_AUDIO,
      mimeType,
      base64,
      systemInstruction: PHEME_SYSTEM_INSTRUCTION,
      temperature: 0.2,
      maxOutputTokens: 4096,
    });
    const minuta = parseMinutaPhemeJson(raw);
    if (!minuta) {
      throw Object.assign(new Error('Gemini no devolvió una minuta JSON válida desde el audio.'), {
        retryable: true,
      });
    }
    return wrapResult(minuta, model);
  } catch (err) {
    const g = err as GeminiGenerateError;
    console.error('[pheme generarMinuta audio]', g);
    throw g;
  }
}
