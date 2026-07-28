/**
 * IurisVigía — auditor técnico-legal (LOPCYMAT) sobre fotos de inspección.
 * Visión: Gemini (GEMINI_API_KEY).
 */

import {
  geminiGenerateWithDocument,
  getGeminiApiKey,
} from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import {
  IURISVIGIA_RESPONSE_SCHEMA,
  parseIurisVigiaReport,
  type IurisVigiaReport,
} from '@/lib/legal/iurisVigiaParse';

export type { EstadoCumplimientoIuris, IurisVigiaReport } from '@/lib/legal/iurisVigiaParse';
export {
  extractIurisJsonObject,
  IURISVIGIA_RESPONSE_SCHEMA,
  parseIurisVigiaReport,
} from '@/lib/legal/iurisVigiaParse';

export const IURISVIGIA_SYSTEM_TEMPLATE = `Eres IurisVigía, un auditor técnico-legal experto en normativa venezolana (LOPCYMAT y estándares técnicos).
Tu tarea es analizar la imagen proporcionada dentro del contexto de: {context}.

Evalúa la imagen y devuelve estrictamente un JSON con este formato:
{
    "descripcion": "Descripción técnica detallada de lo observado en la imagen.",
    "nota_legal": "Referencia técnica o legal sobre si esto cumple o no (ej: Art. 62 LOPCYMAT).",
    "estado_cumplimiento": "Conforme / No Conforme / Observación",
    "riesgo_identificado": "Descripción breve del riesgo técnico o legal."
}
Si la imagen no es clara o no se puede analizar, indica "No analizable" en los campos.`;

export function buildIurisVigiaSystemPrompt(context: string): string {
  return IURISVIGIA_SYSTEM_TEMPLATE.replaceAll('{context}', context.trim() || 'Inspección general');
}

async function imageUrlToInline(
  imageUrl: string,
): Promise<{ mimeType: string; base64: string }> {
  const url = imageUrl.trim();
  const dataMatch = /^data:([^;]+);base64,(.+)$/i.exec(url);
  if (dataMatch) {
    return { mimeType: dataMatch[1]!.trim() || 'image/jpeg', base64: dataMatch[2]! };
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo descargar la imagen (${res.status})`);
  }
  const mimeType =
    res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());
  return { mimeType, base64: buf.toString('base64') };
}

function resolveIurisModel(override?: string): string {
  return (
    override?.trim() ||
    process.env.LEGAL_VISION_MODEL?.trim() ||
    process.env.GEMINI_LEGAL_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL
  );
}

/**
 * Analiza una imagen (URL pública/firmada o data URL) con Gemini vision.
 */
export async function analyzeInspectionPhoto(
  imageUrl: string,
  context: string,
  options?: { geminiApiKey?: string; model?: string },
): Promise<IurisVigiaReport> {
  const url = imageUrl.trim();
  if (!url) throw new Error('image_url requerido');

  const apiKey = (options?.geminiApiKey || getGeminiApiKey() || '').trim();
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY');

  const model = resolveIurisModel(options?.model);
  const systemPrompt = buildIurisVigiaSystemPrompt(context);
  const { mimeType, base64 } = await imageUrlToInline(url);

  const content = await geminiGenerateWithDocument({
    model,
    mimeType,
    base64,
    systemInstruction: systemPrompt,
    temperature: 0.2,
    maxOutputTokens: 4096,
    responseSchema: IURISVIGIA_RESPONSE_SCHEMA,
    prompt:
      'Analiza esta fotografía para mi reporte legal. Responde solo JSON con las claves descripcion, nota_legal, estado_cumplimiento y riesgo_identificado.',
  });

  try {
    return parseIurisVigiaReport(content);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const preview = content.replace(/\s+/g, ' ').slice(0, 180);
    throw new Error(
      preview
        ? `Respuesta IurisVigía no es JSON válido (${detail}). Vista previa: ${preview}`
        : `Respuesta IurisVigía no es JSON válido (${detail})`,
    );
  }
}
