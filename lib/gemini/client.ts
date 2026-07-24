import { ApiError, GoogleGenAI } from '@google/genai';

export type GeminiGenerateError = Error & { retryable?: boolean; status?: number };

let clientSingleton: GoogleGenAI | null = null;

export function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function requireGeminiApiKey(): string {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY no está configurada. Añádala en .env.local para usar el modo IA.',
    );
  }
  return key;
}

function getGeminiClient(): GoogleGenAI {
  if (!clientSingleton) {
    clientSingleton = new GoogleGenAI({ apiKey: requireGeminiApiKey() });
  }
  return clientSingleton;
}

export function mapGeminiError(err: unknown, model: string): GeminiGenerateError {
  if (err instanceof ApiError) {
    const message = geminiErrorMessage(err.status, err.message, model);
    const retryable = err.status === 429 || err.status === 503 || err.status === 404;
    return Object.assign(new Error(message), { retryable, status: err.status });
  }

  const raw = err instanceof Error ? err.message : String(err);
  const retryable =
    raw.includes('429') ||
    raw.includes('503') ||
    raw.toLowerCase().includes('quota') ||
    raw.toLowerCase().includes('unavailable');
  return Object.assign(new Error(raw || 'Error al consultar Gemini.'), { retryable });
}

function geminiErrorMessage(status: number, raw: string, model: string): string {
  const apiMsg = raw.slice(0, 400);

  if (status === 429 || apiMsg.includes('quota') || apiMsg.includes('Quota')) {
    return `Cuota de Gemini agotada para el modelo ${model}. Espere unos minutos o configure GEMINI_PROCUREMENT_MODEL=gemini-2.5-flash en .env.local.`;
  }
  if (status === 503) {
    return `El modelo ${model} está saturado. Intente de nuevo en unos segundos.`;
  }
  if (status === 401 || status === 403) {
    return 'Clave GEMINI_API_KEY inválida o sin permisos. Revise .env.local.';
  }
  if (status === 404) {
    return `Modelo ${model} no disponible. Revise el nombre del modelo en la configuración.`;
  }
  return apiMsg || 'No se pudo completar la solicitud con Gemini.';
}

export type GeminiTextRequest = {
  model: string;
  prompt?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  /** Historial alternando user / model (sin el prompt final si ya está en history). */
  history?: Array<{ role: 'user' | 'model'; text: string }>;
};

export async function geminiGenerateText(req: GeminiTextRequest): Promise<string> {
  const ai = getGeminiClient();

  const turns = [...(req.history ?? [])];
  if (req.prompt?.trim()) {
    turns.push({ role: 'user', text: req.prompt.trim() });
  }
  if (turns.length === 0) {
    throw new Error('Se requiere prompt o historial de conversación.');
  }

  const contents = turns.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  try {
    const response = await ai.models.generateContent({
      model: req.model,
      contents,
      config: {
        systemInstruction: req.systemInstruction,
        temperature: req.temperature ?? 0.35,
        maxOutputTokens: req.maxOutputTokens ?? 2048,
        responseMimeType: req.responseMimeType,
      },
    });

    const text = response.text?.trim() ?? '';
    if (!text) {
      throw Object.assign(new Error('Gemini no devolvió texto utilizable.'), { retryable: true });
    }
    return text;
  } catch (err) {
    throw mapGeminiError(err, req.model);
  }
}

export type GeminiDocumentRequest = {
  model: string;
  prompt: string;
  mimeType: string;
  base64: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: object;
};

export async function geminiGenerateWithDocument(req: GeminiDocumentRequest): Promise<string> {
  const ai = getGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model: req.model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: req.prompt },
            { inlineData: { mimeType: req.mimeType, data: req.base64 } },
          ],
        },
      ],
      config: {
        systemInstruction: req.systemInstruction,
        temperature: req.temperature ?? 0,
        maxOutputTokens: req.maxOutputTokens ?? 16384,
        responseMimeType: 'application/json',
        responseSchema: req.responseSchema,
      },
    });

    const text = response.text?.trim() ?? '';
    if (!text) {
      throw Object.assign(new Error('La IA no devolvió datos del documento.'), { retryable: true });
    }
    return text;
  } catch (err) {
    throw mapGeminiError(err, req.model);
  }
}
