/**
 * IurisVigía — auditor técnico-legal (LOPCYMAT) sobre fotos de inspección.
 * Visión: Gemini (GEMINI_API_KEY).
 */

import {
  geminiGenerateWithDocument,
  getGeminiApiKey,
} from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';

export type EstadoCumplimientoIuris =
  | 'Conforme'
  | 'No Conforme'
  | 'Observación'
  | 'No analizable';

export type IurisVigiaReport = {
  descripcion: string;
  nota_legal: string;
  estado_cumplimiento: EstadoCumplimientoIuris | string;
  riesgo_identificado: string;
};

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

function parseReport(raw: string): IurisVigiaReport {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned) as Partial<IurisVigiaReport>;
  return {
    descripcion: String(parsed.descripcion ?? 'No analizable'),
    nota_legal: String(parsed.nota_legal ?? 'No analizable'),
    estado_cumplimiento: String(parsed.estado_cumplimiento ?? 'No analizable'),
    riesgo_identificado: String(parsed.riesgo_identificado ?? 'No analizable'),
  };
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
    maxOutputTokens: 2048,
    prompt: 'Analiza esta fotografía para mi reporte legal. Responde solo JSON.',
  });

  try {
    return parseReport(content);
  } catch {
    throw new Error('Respuesta IurisVigía no es JSON válido');
  }
}
