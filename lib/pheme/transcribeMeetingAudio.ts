import OpenAI from 'openai';
import type { TranscribeMeetingResult } from '@/types/pheme';

function bufferToFile(audio: Buffer, fileName: string, mimeType: string): File {
  const bytes = new Uint8Array(audio);
  return new File([bytes], fileName || 'audio.webm', {
    type: mimeType || 'audio/webm',
  });
}

const OPENAI_WHISPER_MODEL = 'whisper-1';
const GROQ_WHISPER_MODEL = 'whisper-large-v3';
const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const DIARIZE_SYSTEM = `Eres un asistente de diarización. Recibes una transcripción de reunión sin etiquetas de hablante.
Devuelve SOLO texto plano, reescribiendo la transcripción con turnos etiquetados así:

[Hablante 1]: ...
[Hablante 2]: ...

Reglas:
- Usa el mínimo de hablantes coherente con el diálogo.
- No inventes contenido; solo reorganiza y etiqueta.
- Mantén el idioma original (español).
- Si no puedes distinguir hablantes, usa [Hablante 1] para todo el bloque.`;

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');
  return new OpenAI({ apiKey });
}

async function diarizeWithLlm(rawTranscript: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || rawTranscript.trim().length < 40) {
    return rawTranscript.trim();
  }

  try {
    const client = getOpenAiClient();
    const completion = await client.chat.completions.create({
      model: process.env.PHEME_CHAT_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: DIARIZE_SYSTEM },
        {
          role: 'user',
          content: `Transcripción:\n\n${rawTranscript.slice(0, 120_000)}`,
        },
      ],
    });
    const labeled = completion.choices[0]?.message?.content?.trim();
    return labeled || rawTranscript.trim();
  } catch {
    return rawTranscript.trim();
  }
}

async function transcribeWithOpenAi(
  audio: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ text: string; duration: number | null; model: string }> {
  const client = getOpenAiClient();
  const file = bufferToFile(audio, fileName || 'audio.webm', mimeType || 'audio/webm');

  const result = await client.audio.transcriptions.create({
    file,
    model: OPENAI_WHISPER_MODEL,
    language: 'es',
    response_format: 'verbose_json',
  });

  const text =
    typeof result === 'string'
      ? result
      : String((result as { text?: string }).text ?? '').trim();

  const duration =
    typeof result === 'object' && result && 'duration' in result
      ? Number((result as { duration?: number }).duration) || null
      : null;

  if (!text) throw new Error('OpenAI Whisper no devolvió texto');
  return { text, duration, model: OPENAI_WHISPER_MODEL };
}

async function transcribeWithGroq(
  audio: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ text: string; duration: number | null; model: string }> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

  const form = new FormData();
  form.append('file', bufferToFile(audio, fileName || 'audio.webm', mimeType || 'audio/webm'));
  form.append('model', GROQ_WHISPER_MODEL);
  form.append('language', 'es');
  form.append('response_format', 'verbose_json');

  const res = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq Whisper ${res.status}: ${body.slice(0, 240)}`);
  }

  const json = (await res.json()) as { text?: string; duration?: number };
  const text = String(json.text ?? '').trim();
  if (!text) throw new Error('Groq Whisper no devolvió texto');
  return {
    text,
    duration: typeof json.duration === 'number' ? json.duration : null,
    model: GROQ_WHISPER_MODEL,
  };
}

export type TranscribeOptions = {
  fileName?: string;
  mimeType?: string;
  /** Preferir groq si hay GROQ_API_KEY; por defecto openai. */
  preferredProvider?: 'openai' | 'groq' | 'auto';
  diarize?: boolean;
};

/**
 * STT con Whisper (OpenAI o Groq) + diarización de hablantes vía LLM.
 */
export async function transcribeMeetingAudio(
  audio: Buffer,
  options: TranscribeOptions = {},
): Promise<TranscribeMeetingResult> {
  if (!audio?.length) throw new Error('Buffer de audio vacío');

  const fileName = options.fileName || 'reunion-audio.webm';
  const mimeType = options.mimeType || 'audio/webm';
  const preferred = options.preferredProvider ?? 'auto';
  const diarize = options.diarize !== false;

  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());

  let provider: 'openai' | 'groq';
  if (preferred === 'groq') {
    if (!hasGroq) throw new Error('GROQ_API_KEY no configurada');
    provider = 'groq';
  } else if (preferred === 'openai') {
    if (!hasOpenAi) throw new Error('OPENAI_API_KEY no configurada');
    provider = 'openai';
  } else if (hasOpenAi) {
    provider = 'openai';
  } else if (hasGroq) {
    provider = 'groq';
  } else {
    throw new Error('Configure OPENAI_API_KEY o GROQ_API_KEY para transcripción');
  }

  let raw: { text: string; duration: number | null; model: string };
  try {
    raw =
      provider === 'groq'
        ? await transcribeWithGroq(audio, fileName, mimeType)
        : await transcribeWithOpenAi(audio, fileName, mimeType);
  } catch (primaryError) {
    // Fallback cruzado si el provider preferido falla
    if (provider === 'openai' && hasGroq) {
      raw = await transcribeWithGroq(audio, fileName, mimeType);
      provider = 'groq';
    } else if (provider === 'groq' && hasOpenAi) {
      raw = await transcribeWithOpenAi(audio, fileName, mimeType);
      provider = 'openai';
    } else {
      throw primaryError;
    }
  }

  const transcript = diarize ? await diarizeWithLlm(raw.text) : raw.text;

  return {
    transcript,
    provider,
    model: raw.model,
    durationSeconds: raw.duration,
  };
}
