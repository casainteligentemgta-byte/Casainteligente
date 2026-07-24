import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import { geminiGenerateWithDocument } from '@/lib/gemini/client';

const SERIALES_SCHEMA = {
  type: 'object',
  properties: {
    seriales: {
      type: 'array',
      items: { type: 'string' },
      description: 'Seriales alfanuméricos visibles en billetes venezolanos (Bs).',
    },
  },
  required: ['seriales'],
};

export async function extraerSerialesBilletesGemini(params: {
  mimeType: string;
  base64: string;
}): Promise<string[]> {
  const raw = await geminiGenerateWithDocument({
    model: GEMINI_PROCUREMENT_DEFAULT_MODEL,
    mimeType: params.mimeType,
    base64: params.base64,
    systemInstruction:
      'Eres un auditor de tesorería. Extrae únicamente seriales de billetes venezolanos legibles en la imagen.',
    prompt:
      'Lista todos los seriales de billetes que puedas leer con confianza. ' +
      'Devuelve JSON {"seriales":["..."]}. Si no hay billetes o no se leen, devuelve {"seriales":[]}.',
    temperature: 0,
    maxOutputTokens: 2048,
    responseSchema: SERIALES_SCHEMA,
  });

  const parsed = JSON.parse(raw) as { seriales?: unknown };
  if (!Array.isArray(parsed.seriales)) return [];

  return parsed.seriales
    .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
    .filter((s) => s.length >= 4);
}
