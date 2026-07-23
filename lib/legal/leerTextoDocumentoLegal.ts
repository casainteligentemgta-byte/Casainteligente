/**
 * Extracción de texto completo de documentos legales (CCT, contratos, etc.)
 * Distinto de plantillas: no convierte campos a {{placeholders}}.
 */

import { geminiGenerateWithDocument, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import { validarArchivoFormato } from '@/lib/legal/plantillasFormatos';

export { validarArchivoFormato };

export async function leerTextoDocumentoLegalCompleto(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ texto: string; extraidoConIa: boolean }> {
  const mime = mimeType || 'application/octet-stream';
  const lower = fileName.toLowerCase();

  if (
    mime.startsWith('text/') ||
    lower.endsWith('.md') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm')
  ) {
    return { texto: buffer.toString('utf8'), extraidoConIa: false };
  }

  if (!getGeminiApiKey()) {
    throw new Error(
      'Para PDF/DOCX se requiere GEMINI_API_KEY (o pegue el texto en .txt/.md).',
    );
  }

  const model =
    process.env.GEMINI_LEGAL_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL;

  const raw = await geminiGenerateWithDocument({
    model,
    mimeType: mime,
    base64: buffer.toString('base64'),
    temperature: 0.1,
    maxOutputTokens: 8192,
    prompt: `Eres asistente legal venezolano. Extrae el texto completo del documento adjunto
(convención colectiva, contrato colectivo u otro instrumento laboral).
Conserva títulos, cláusulas y numeración. No inventes contenido.
Responde SOLO con el texto extraído en español, sin explicaciones ni fences markdown.`,
  });

  const texto = raw
    .trim()
    .replace(/^```(?:markdown|md|text)?\s*/i, '')
    .replace(/\s*```$/i, '');

  if (texto.length < 40) {
    throw new Error(
      'No se pudo extraer texto suficiente del archivo. Pruebe con PDF más legible o suba un .txt/.md.',
    );
  }

  return { texto, extraidoConIa: true };
}
