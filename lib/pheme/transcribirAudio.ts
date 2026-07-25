import { createPartFromUri, createUserContent } from '@google/genai';
import {
  getGeminiAiClient,
  getGeminiApiKey,
  mapGeminiError,
} from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';

const PROMPT_DIARIZACION = `Escucha atentamente este audio de reunión y genera una transcripción literal completa.
Es fundamental que identifiques y etiquetes a cada hablante según su voz o cuando digan su nombre.

Formato requerido:
Hablante 1 (o Nombre si lo identificas): [Texto dicho]
Hablante 2 (o Nombre si lo identificas): [Texto dicho]

Responde solo con la transcripción etiquetada, en español.`;

function phemeModel(): string {
  return (
    process.env.GEMINI_PHEME_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileStateName(state: unknown): string {
  if (state == null) return '';
  if (typeof state === 'string') return state;
  if (typeof state === 'object' && state !== null && 'name' in state) {
    return String((state as { name?: string }).name ?? '');
  }
  return String(state);
}

/**
 * Sube audio a Gemini Files API, espera ACTIVE y genera transcripción con diarización.
 * Equivalente a `transcribir_audio` del prototipo Python.
 */
export async function transcribirAudioConDiarizacion(opts: {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
}): Promise<string> {
  if (!getGeminiApiKey()) {
    throw Object.assign(new Error('GEMINI_API_KEY no configurada.'), { status: 503 });
  }

  const mimeType = (opts.mimeType || 'audio/mpeg').trim();
  const fileName = (opts.fileName || 'reunion.mp3').trim() || 'reunion.mp3';
  const ai = getGeminiAiClient();
  const model = phemeModel();

  const blob = new Blob([new Uint8Array(opts.buffer)], { type: mimeType });

  let uploaded;
  try {
    uploaded = await ai.files.upload({
      file: blob,
      config: { mimeType, displayName: fileName },
    });
  } catch (err) {
    throw mapGeminiError(err, model);
  }

  const fileNameRemote = uploaded.name;
  if (!fileNameRemote) {
    throw Object.assign(new Error('Gemini Files no devolvió nombre de archivo.'), {
      retryable: true,
    });
  }

  const deadline = Date.now() + 120_000;
  try {
    let state = fileStateName(uploaded.state);
    while (state.includes('PROCESSING') || state === 'STATE_UNSPECIFIED' || !state) {
      if (Date.now() > deadline) {
        throw Object.assign(
          new Error('El audio sigue en PROCESSING en Gemini tras 120s.'),
          { retryable: true },
        );
      }
      await sleep(2000);
      uploaded = await ai.files.get({ name: fileNameRemote });
      state = fileStateName(uploaded.state);
      if (state.includes('FAILED')) {
        throw new Error('Gemini falló al procesar el archivo de audio.');
      }
      if (state.includes('ACTIVE')) break;
    }

    if (!uploaded.uri || !uploaded.mimeType) {
      throw new Error('Archivo de audio sin URI/mime tras el procesamiento.');
    }

    const response = await ai.models.generateContent({
      model,
      contents: createUserContent([
        createPartFromUri(uploaded.uri, uploaded.mimeType),
        PROMPT_DIARIZACION,
      ]),
      config: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const text = response.text?.trim() ?? '';
    if (!text) {
      throw Object.assign(new Error('Gemini no devolvió transcripción.'), { retryable: true });
    }
    return text;
  } catch (err) {
    if (err && typeof err === 'object' && 'message' in err) {
      throw mapGeminiError(err, model);
    }
    throw err;
  } finally {
    try {
      await ai.files.delete({ name: fileNameRemote });
    } catch (cleanupErr) {
      console.warn('[pheme] no se pudo borrar archivo remoto Gemini:', cleanupErr);
    }
  }
}
