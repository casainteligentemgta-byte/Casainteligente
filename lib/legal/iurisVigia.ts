/**
 * IurisVigía — auditor técnico-legal (LOPCYMAT) sobre fotos de inspección.
 */

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
  const parsed = JSON.parse(raw) as Partial<IurisVigiaReport>;
  return {
    descripcion: String(parsed.descripcion ?? 'No analizable'),
    nota_legal: String(parsed.nota_legal ?? 'No analizable'),
    estado_cumplimiento: String(parsed.estado_cumplimiento ?? 'No analizable'),
    riesgo_identificado: String(parsed.riesgo_identificado ?? 'No analizable'),
  };
}

/**
 * Analiza una imagen (URL pública/firmada o data URL) con gpt-4o vision.
 */
export async function analyzeInspectionPhoto(
  imageUrl: string,
  context: string,
  options?: { openaiApiKey?: string; model?: string },
): Promise<IurisVigiaReport> {
  const url = imageUrl.trim();
  if (!url) throw new Error('image_url requerido');

  const apiKey = (options?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY');

  const model = options?.model?.trim() || process.env.LEGAL_VISION_MODEL?.trim() || 'gpt-4o';
  const systemPrompt = buildIurisVigiaSystemPrompt(context);

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
            { type: 'image_url', image_url: { url } },
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
