/**
 * IurisVigía — auditor técnico-legal (LOPCYMAT) sobre fotos de inspección.
 * Usa OpenAI gpt-4o si hay OPENAI_API_KEY; si no, Gemini (GEMINI_API_KEY).
 */

import { geminiGenerateWithDocument, getGeminiApiKey } from '@/lib/gemini/client';
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
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma > 0) {
      const meta = url.slice(0, comma);
      const base64 = url.slice(comma + 1);
      const mimeType = meta.match(/^data:([^;]+)/)?.[1] || 'image/jpeg';
      return { mimeType, base64 };
    }
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

async function analyzeWithOpenAi(
  imageUrl: string,
  systemPrompt: string,
  apiKey: string,
  model: string,
): Promise<IurisVigiaReport> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza esta fotografía para mi reporte legal.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI vision ${res.status}: ${body.slice(0, 280)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI no devolvió contenido');

  try {
    return parseReport(content);
  } catch {
    throw new Error('Respuesta IurisVigía no es JSON válido');
  }
}

async function analyzeWithGemini(
  imageUrl: string,
  systemPrompt: string,
  model: string,
): Promise<IurisVigiaReport> {
  const { mimeType, base64 } = await imageUrlToInline(imageUrl);
  const content = await geminiGenerateWithDocument({
    model,
    systemInstruction: systemPrompt,
    prompt: 'Analiza esta fotografía para mi reporte legal. Responde solo JSON válido.',
    mimeType,
    base64,
    temperature: 0.2,
    maxOutputTokens: 2048,
  });

  try {
    return parseReport(content);
  } catch {
    throw new Error('Respuesta IurisVigía no es JSON válido');
  }
}

/**
 * Analiza una imagen (URL pública/firmada o data URL).
 * Preferencia: OpenAI si hay clave; si no, Gemini (GEMINI_API_KEY ya usada en la app).
 */
export async function analyzeInspectionPhoto(
  imageUrl: string,
  context: string,
  options?: { openaiApiKey?: string; model?: string },
): Promise<IurisVigiaReport> {
  const url = imageUrl.trim();
  if (!url) throw new Error('image_url requerido');

  const systemPrompt = buildIurisVigiaSystemPrompt(context);
  const openaiKey = (options?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  const requested = options?.model?.trim() || process.env.LEGAL_VISION_MODEL?.trim() || '';
  const preferGemini =
    requested.toLowerCase().startsWith('gemini') || !openaiKey;

  if (!preferGemini && openaiKey) {
    const model = requested || 'gpt-4o';
    return analyzeWithOpenAi(url, systemPrompt, openaiKey, model);
  }

  if (getGeminiApiKey()) {
    let model =
      requested ||
      process.env.GEMINI_LEGAL_MODEL?.trim() ||
      process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
      GEMINI_PROCUREMENT_DEFAULT_MODEL;
    if (!model.toLowerCase().startsWith('gemini')) {
      model = GEMINI_PROCUREMENT_DEFAULT_MODEL;
    }
    return analyzeWithGemini(url, systemPrompt, model);
  }

  if (openaiKey) {
    const model = requested || 'gpt-4o';
    return analyzeWithOpenAi(url, systemPrompt, openaiKey, model);
  }

  throw new Error(
    'Falta GEMINI_API_KEY (o OPENAI_API_KEY) para el análisis de visión IurisVigía',
  );
}
