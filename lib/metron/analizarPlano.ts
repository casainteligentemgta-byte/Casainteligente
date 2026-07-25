import {
  GEMINI_PROCUREMENT_DEFAULT_MODEL,
  procurementModelCandidates,
} from '@/lib/almacen/geminiProcurementModels';
import { geminiGenerateWithDocument, getGeminiApiKey } from '@/lib/gemini/client';
import {
  METRON_SYSTEM_INSTRUCTION,
  buildPromptUsuarioMetron,
} from '@/lib/metron/identidad';
import { parseRespuestaMetron } from '@/lib/metron/parseRespuesta';
import { METRON_RESPONSE_SCHEMA } from '@/lib/metron/schemaRespuesta';
import type { MetronAnalisisResultado, MetronDisciplina } from '@/types/metron';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export const METRON_MAX_BYTES = 15 * 1024 * 1024;

export function metronModelCandidates(): string[] {
  const preferred = process.env.GEMINI_METRON_MODEL?.trim();
  const base = procurementModelCandidates();
  if (preferred) {
    return Array.from(new Set([preferred, ...base]));
  }
  return base.length ? base : [GEMINI_PROCUREMENT_DEFAULT_MODEL];
}

export function assertMetronMime(mimeType: string): void {
  const m = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME.has(m)) {
    throw new Error(
      `Tipo de archivo no soportado (${mimeType || 'desconocido'}). Use PDF o imagen (JPG/PNG/WEBP).`,
    );
  }
}

export type AnalizarPlanoMetronInput = {
  base64: string;
  mimeType: string;
  nombreObra?: string;
  codigoPlano?: string;
  nombrePlano?: string;
  disciplinaPreferida?: MetronDisciplina | 'auto';
};

export type AnalizarPlanoMetronOutput = {
  resultado: MetronAnalisisResultado;
  modelo: string;
  desdeGemini: boolean;
};

function heuristicFallback(input: AnalizarPlanoMetronInput): MetronAnalisisResultado {
  const titulo =
    (input.nombrePlano ?? '').trim() ||
    (input.codigoPlano ?? '').trim() ||
    'Plano sin título';
  return {
    disciplina: (input.disciplinaPreferida && input.disciplinaPreferida !== 'auto'
      ? input.disciplinaPreferida
      : 'desconocida') as MetronDisciplina,
    especialidades: [],
    titulo_plano: titulo,
    escala_detectada: '',
    resumen:
      'Modo local (sin GEMINI_API_KEY): no se pudo leer el plano. Configure GEMINI_API_KEY para cómputo automático.',
    supuestos: ['Análisis heurístico sin visión del documento.'],
    alertas: ['Falta GEMINI_API_KEY; cómputo vacío.'],
    computos: [],
  };
}

export async function analizarPlanoMetron(
  input: AnalizarPlanoMetronInput,
): Promise<AnalizarPlanoMetronOutput> {
  const mime = (input.mimeType || '').split(';')[0].trim().toLowerCase() || 'application/pdf';
  assertMetronMime(mime);

  if (!getGeminiApiKey()) {
    return {
      resultado: heuristicFallback(input),
      modelo: 'local',
      desdeGemini: false,
    };
  }

  const prompt = buildPromptUsuarioMetron({
    nombreObra: input.nombreObra,
    codigoPlano: input.codigoPlano,
    nombrePlano: input.nombrePlano,
    disciplinaPreferida: input.disciplinaPreferida ?? 'auto',
  });

  let lastErr: unknown;
  for (const model of metronModelCandidates()) {
    try {
      const text = await geminiGenerateWithDocument({
        model,
        prompt,
        mimeType: mime,
        base64: input.base64,
        systemInstruction: METRON_SYSTEM_INSTRUCTION,
        temperature: 0.15,
        maxOutputTokens: 8192,
        responseSchema: METRON_RESPONSE_SCHEMA,
      });
      const resultado = parseRespuestaMetron(text);
      return { resultado, modelo: model, desdeGemini: true };
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof Error &&
        ('retryable' in err ? Boolean((err as { retryable?: boolean }).retryable) : false);
      if (!retryable) break;
    }
  }

  const msg =
    lastErr instanceof Error ? lastErr.message : 'No se pudo analizar el plano con Metron.';
  throw Object.assign(new Error(msg), { cause: lastErr });
}
