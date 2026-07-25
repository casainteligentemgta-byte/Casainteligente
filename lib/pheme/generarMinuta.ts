import {
  geminiGenerateText,
  geminiGenerateWithDocument,
  getGeminiApiKey,
  type GeminiGenerateError,
} from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import {
  buildPromptUsuarioPheme,
  PHEME_SYSTEM_INSTRUCTION,
  PHEME_USER_PROMPT_AUDIO,
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

function wrapResult(
  titulo: string,
  minuta: MinutaPheme,
  opts: { desdeGemini: boolean; modelo?: string; aviso?: string },
): GenerarMinutaPhemeResult {
  return {
    titulo_reunion: titulo,
    minuta,
    markdown: formatearMinutaMarkdown(minuta, titulo),
    desdeGemini: opts.desdeGemini,
    modelo: opts.modelo,
    aviso: opts.aviso,
  };
}

function minutaOfflineSinClave(titulo: string, transcripcion: string): GenerarMinutaPhemeResult {
  const preview = transcripcion.trim().slice(0, 280);
  const minuta: MinutaPheme = {
    resumen_ejecutivo:
      'No se pudo generar la minuta con IA: falta GEMINI_API_KEY. Configure la clave y vuelva a procesar la reunión.',
    puntos_clave: preview
      ? ['Transcripción recibida (análisis automático no disponible sin Gemini).']
      : [],
    acuerdos: [],
    pendientes_o_alertas: [
      'Configurar GEMINI_API_KEY en el entorno del servidor para activar Pheme.',
    ],
  };
  return wrapResult(titulo, minuta, {
    desdeGemini: false,
    aviso: 'Modo sin GEMINI_API_KEY — no se llamó a la API.',
  });
}

/**
 * Función principal del agente Pheme (equivalente a `procesar_reunion_con_pheme`).
 */
export async function procesarReunionConPheme(
  tituloReunion: string,
  transcripcionTexto: string,
): Promise<GenerarMinutaPhemeResult> {
  const titulo = (tituloReunion ?? '').trim() || 'Sin título';
  const texto = (transcripcionTexto ?? '').trim();
  if (!texto) {
    throw Object.assign(new Error('La transcripción está vacía.'), { status: 400 });
  }
  if (texto.length > 120_000) {
    throw Object.assign(new Error('La transcripción supera el límite de 120 000 caracteres.'), {
      status: 400,
    });
  }

  if (!getGeminiApiKey()) {
    return minutaOfflineSinClave(titulo, texto);
  }

  const model = phemeModel();
  const prompt = buildPromptUsuarioPheme(titulo, texto);

  try {
    const raw = await geminiGenerateText({
      model,
      systemInstruction: PHEME_SYSTEM_INSTRUCTION,
      prompt,
      temperature: 0.25,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    });
    // Limpiar y parsear (strip ```json … ```)
    const minuta = parseMinutaPhemeJson(raw);
    if (!minuta) {
      throw Object.assign(new Error('Gemini no devolvió una minuta JSON válida.'), {
        retryable: true,
      });
    }
    return wrapResult(titulo, minuta, { desdeGemini: true, modelo: model });
  } catch (err) {
    const g = err as GeminiGenerateError;
    console.error('[pheme procesarReunionConPheme]', g);
    throw g;
  }
}

/** @deprecated Preferir `procesarReunionConPheme`. */
export async function generarMinutaDesdeTexto(
  transcripcion: string,
  tituloReunion = 'Sin título',
): Promise<GenerarMinutaPhemeResult> {
  return procesarReunionConPheme(tituloReunion, transcripcion);
}

/**
 * Genera minuta Pheme a partir de audio (base64 + mime).
 */
export async function generarMinutaDesdeAudio(opts: {
  tituloReunion?: string;
  base64: string;
  mimeType: string;
}): Promise<GenerarMinutaPhemeResult> {
  const titulo = (opts.tituloReunion ?? '').trim() || 'Sin título';
  const base64 = (opts.base64 ?? '').trim();
  const mimeType = (opts.mimeType ?? '').trim() || 'audio/ogg';
  if (!base64) {
    throw Object.assign(new Error('Audio vacío (base64 requerido).'), { status: 400 });
  }
  if (!getGeminiApiKey()) {
    return minutaOfflineSinClave(titulo, '');
  }

  const model = phemeModel();
  const prompt = PHEME_USER_PROMPT_AUDIO.replace('{{TITULO}}', titulo);
  try {
    const raw = await geminiGenerateWithDocument({
      model,
      prompt,
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
    return wrapResult(titulo, minuta, { desdeGemini: true, modelo: model });
  } catch (err) {
    const g = err as GeminiGenerateError;
    console.error('[pheme generarMinuta audio]', g);
    throw g;
  }
}
