import { geminiGenerateWithDocument, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import type { LegalPlantillaVariable } from '@/lib/legal/documentosCatalogo';
import { LEGAL_TIPOS_DOCUMENTO } from '@/lib/legal/documentosCatalogo';

export const LEGAL_PLANTILLAS_BUCKET = 'legal-plantillas';

export const LEGAL_FORMATO_MIME_OK = new Set([
  'text/plain',
  'text/markdown',
  'text/html',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_BYTES = 15 * 1024 * 1024;

export function slugCodigoPlantilla(titulo: string, fallback = 'formato'): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return base || fallback;
}

export function extraerVariablesDeCuerpo(cuerpo: string): LegalPlantillaVariable[] {
  const keys = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo || '')) != null) {
    keys.add(m[1]);
  }
  return Array.from(keys).map((key) => ({
    key,
    label: key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

export function esTipoDocumentoLegal(tipo: string): boolean {
  return LEGAL_TIPOS_DOCUMENTO.some((t) => t.value === tipo);
}

export function validarArchivoFormato(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const mime = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  const okExt =
    name.endsWith('.md') ||
    name.endsWith('.txt') ||
    name.endsWith('.html') ||
    name.endsWith('.htm') ||
    name.endsWith('.pdf') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx');
  const okMime = !mime || LEGAL_FORMATO_MIME_OK.has(mime) || mime.startsWith('text/');
  if (!okExt && !okMime) {
    return 'Formato no soportado. Use MD, TXT, HTML, PDF o DOCX.';
  }
  if (file.size > MAX_BYTES) {
    return 'El archivo supera el límite de 15 MB.';
  }
  return null;
}

function mimeDesdeNombre(name: string, fallback: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (n.endsWith('.doc')) return 'application/msword';
  if (n.endsWith('.html') || n.endsWith('.htm')) return 'text/html';
  if (n.endsWith('.md')) return 'text/markdown';
  if (n.endsWith('.txt')) return 'text/plain';
  return fallback || 'application/octet-stream';
}

export async function leerTextoArchivoFormato(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ cuerpo: string; extraidoConIa: boolean }> {
  const mime = mimeType || mimeDesdeNombre(fileName, 'text/plain');
  const lower = fileName.toLowerCase();

  if (
    mime.startsWith('text/') ||
    lower.endsWith('.md') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm')
  ) {
    return { cuerpo: buffer.toString('utf8'), extraidoConIa: false };
  }

  if (!getGeminiApiKey()) {
    return {
      cuerpo:
        `# ${fileName.replace(/\.[^.]+$/, '')}\n\n` +
        `<!-- Formato subido: ${fileName}. Pegue aquí el cuerpo en Markdown con variables {{clave}}. -->\n`,
      extraidoConIa: false,
    };
  }

  const model =
    process.env.GEMINI_LEGAL_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL;

  try {
    const raw = await geminiGenerateWithDocument({
      model,
      mimeType: mime,
      base64: buffer.toString('base64'),
      temperature: 0.1,
      maxOutputTokens: 8192,
      prompt: `Eres un asistente legal. Convierte el documento adjunto en una plantilla Markdown en español.
Conserva la estructura (títulos, cláusulas, firmas).
Si hay campos variables (nombres, fechas, montos, cédulas), reemplázalos por placeholders {{snake_case}}.
Responde SOLO con el Markdown de la plantilla, sin explicaciones ni fences.`,
    });
    const cuerpo = raw
      .trim()
      .replace(/^```(?:markdown|md)?\s*/i, '')
      .replace(/\s*```$/i, '');
    if (cuerpo.length > 20) {
      return { cuerpo, extraidoConIa: true };
    }
  } catch (err) {
    console.warn('[plantillasFormatos] Gemini extract:', err);
  }

  return {
    cuerpo:
      `# ${fileName.replace(/\.[^.]+$/, '')}\n\n` +
      `<!-- No se pudo extraer texto automáticamente de ${fileName}. Edite el cuerpo en Markdown. -->\n`,
    extraidoConIa: false,
  };
}

export function buildPlantillaStoragePath(orgId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_').trim().slice(0, 100) || 'formato';
  return `${orgId}/${Date.now()}-${safe}`;
}
