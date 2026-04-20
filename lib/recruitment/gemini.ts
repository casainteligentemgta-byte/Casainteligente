import { GEMINI_MODEL } from '@/lib/recruitment/constants';
import type { RecruitmentAnalysisJson } from '@/types/recruitment';

const SYSTEM_INSTRUCTION = `Eres un entrevistador táctico para reclutamiento operativo (domótica/lujo).
El saludo inicial ya lo envió el sistema al candidato; no lo repitas salvo que aporte valor.
En cada turno debes devolver SOLO un JSON válido con esta forma exacta (sin markdown):
{
  "turnIndex": number,
  "disc": { "dominant": "D"|"I"|"S"|"C"|"mixed", "scores": { "D": 0-1, "I": 0-1, "S": 0-1, "C": 0-1 } },
  "integrity": { "riskScore": 0-1, "dimensions": { "operativa"?: 0-1, "honestidad"?: 0-1, "consistencia"?: 0-1 }, "notes": string opcional },
  "signals": {
    "contradictionDetected": boolean,
    "evasionDetected": boolean,
    "confrontationHook": string opcional (breve, en español, para confrontar con respeto)
  },
  "gma": opcional { "items": [{ "itemId": number, "correct": boolean }], "scoreOutOf5": number },
  "assistantReply": string (siguiente mensaje al candidato en español, una o dos frases)
}
Si detectas contradicción o evasión fuerte, pon confrontationHook y marca los flags. Sé profesional.
Varía el contenido de assistantReply en cada turno: no repitas la misma pregunta ni frases idénticas al mensaje anterior del asistente.
La interfaz prioriza selección simple: formula preguntas que encajen con escala 1–5, sí/no u opciones A–D cuando sea razonable; el candidato suele contestar con mensajes tipo "Likert 1–5...", "Respuesta única: Sí/No", "Selección única: opción A–D". Acepta también texto libre si lo envía. Intégralo todo en integrity/disc y en tu siguiente pregunta sin pedir que repita el formato.`;

function parseAnalysis(text: string, turnIndex: number): RecruitmentAnalysisJson {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  const slice =
    jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed;
  try {
    const raw = JSON.parse(slice) as RecruitmentAnalysisJson;
    raw.turnIndex = turnIndex;
    return raw;
  } catch {
    return fallbackAnalysis(turnIndex, 'bad_json');
  }
}

/** Respuestas rotativas cuando no hay Gemini o la salida no es JSON (evita repetir la misma frase). */
const FALLBACK_ASSISTANT_REPLIES = [
  'Gracias. ¿Puedes concretar un ejemplo reciente de tu responsabilidad operativa?',
  'Entendido. Si tuvieras que priorizar dos tareas urgentes el mismo día, ¿cómo lo harías?',
  '¿Qué harías si un cliente exige un plazo que no es viable técnicamente?',
  'Cuéntame un conflicto con un compañero o proveedor y cómo lo cerraste.',
  '¿Cómo compruebas que un trabajo quedó bien hecho antes de darlo por cerrado?',
  'Describe un error tuyo en el trabajo y qué aprendiste.',
  '¿Cómo organizas tu día cuando hay interrupciones constantes?',
  '¿Qué métrica usarías para medir tu propio desempeño operativo esta semana?',
];

function fallbackAnalysis(turnIndex: number, reason?: 'no_key' | 'bad_json' | 'api_error'): RecruitmentAnalysisJson {
  const idx = Math.max(0, turnIndex - 1) % FALLBACK_ASSISTANT_REPLIES.length;
  const note =
    reason === 'no_key'
      ? 'Modo sin GEMINI_API_KEY (respuestas genéricas rotativas).'
      : reason === 'api_error'
        ? 'Gemini no disponible en este turno; respuesta genérica.'
        : 'Análisis no disponible (respuesta no JSON).';
  return {
    turnIndex,
    disc: {
      dominant: 'mixed',
      scores: { D: 0.25, I: 0.25, S: 0.25, C: 0.25 },
    },
    integrity: {
      riskScore: 0.3,
      dimensions: { operativa: 0.3, honestidad: 0.3, consistencia: 0.3 },
      notes: note,
    },
    signals: {
      contradictionDetected: false,
      evasionDetected: false,
    },
    assistantReply: FALLBACK_ASSISTANT_REPLIES[idx],
  };
}

function historyForApi(history: Array<{ role: 'user' | 'assistant'; content: string }>) {
  if (history[0]?.role === 'assistant') {
    return history.slice(1);
  }
  return history;
}

export async function analyzeRecruitmentTurn(input: {
  turnIndex: number;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<RecruitmentAnalysisJson> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return fallbackAnalysis(input.turnIndex, 'no_key');
  }

  const trimmed = historyForApi(input.history);
  const parts = trimmed.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: parts,
    generationConfig: {
      temperature: 0.55,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[recruitment/gemini]', res.status, err);
    return fallbackAnalysis(input.turnIndex, 'api_error');
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return parseAnalysis(text, input.turnIndex);
}
