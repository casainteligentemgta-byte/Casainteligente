import type { SupabaseClient } from '@supabase/supabase-js';
import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import {
  ASESOR_MAX_PREGUNTAS,
  ASESOR_MIN_PREGUNTAS_DICTAMEN,
  esCategoriaAsesor,
  esSubmoduloDeCategoria,
  submoduloLabel,
} from '@/lib/legal/asesorCasoCatalogo';
import {
  ASESOR_ENTREVISTA_SYSTEM,
  buildCaseBrief,
  formatDictamenSystemPrompt,
} from '@/lib/legal/asesorCasoPrompt';
import { formatContextoLegal, type ContextoLegalFragmento } from '@/lib/legal/abogadoSeniorPrompt';
import {
  searchLegalKnowledge,
  type LegalKnowledgeHit,
} from '@/lib/legal/searchLegalKnowledge';

export type AsesorTurnMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AsesorDictamenSecciones = {
  hechos_asumidos: string;
  analisis_juridico: string;
  normativa: string;
  jurisprudencia: string;
  recomendacion: string;
  vista_contraparte: string;
  replica_sugerida: string;
  lagunas_e_incertidumbre: string;
  texto_completo: string;
};

export type AsesorCasoFuente = {
  index: number;
  id: string;
  referencia: string | null;
  source: string | null;
  categoria: string | null;
  tipo: string | null;
  similarity: number;
  excerpt: string;
};

export type AsesorCasoTurnResult = {
  fase: 'pregunta' | 'dictamen';
  mensaje: string;
  categoria: string | null;
  submodulo: string | null;
  submodulo_label: string | null;
  preguntas_hechas: number;
  preguntas_objetivo: number;
  hechos_consolidados: string;
  dictamen: AsesorDictamenSecciones | null;
  fuentes: AsesorCasoFuente[];
  model: string;
  provider: 'openai' | 'gemini';
};

type EntrevistaJson = {
  accion?: string;
  categoria?: string | null;
  submodulo?: string | null;
  mensaje?: string;
  hechos_consolidados?: string;
  motivo?: string;
};

type DictamenJson = {
  hechos_asumidos?: string;
  analisis_juridico?: string;
  normativa?: string;
  jurisprudencia?: string;
  recomendacion?: string;
  vista_contraparte?: string;
  replica_sugerida?: string;
  lagunas_e_incertidumbre?: string;
};

function resolveChatModel(preferred?: string): { model: string; provider: 'openai' | 'gemini' } {
  const openaiKey = process.env.OPENAI_API_KEY?.trim() || '';
  const envModel = (
    preferred ||
    process.env.LEGAL_CHAT_MODEL ||
    process.env.GEMINI_LEGAL_MODEL ||
    ''
  ).trim();

  if (envModel.toLowerCase().startsWith('gpt') && openaiKey) {
    return { model: envModel, provider: 'openai' };
  }
  if (getGeminiApiKey()) {
    let model =
      envModel ||
      process.env.GEMINI_LEGAL_MODEL?.trim() ||
      GEMINI_PROCUREMENT_DEFAULT_MODEL;
    if (!model.startsWith('gemini')) {
      model = GEMINI_PROCUREMENT_DEFAULT_MODEL;
    }
    return { model, provider: 'gemini' };
  }
  if (openaiKey) {
    return { model: envModel.startsWith('gpt') ? envModel : 'gpt-4o', provider: 'openai' };
  }
  throw new Error(
    'Falta GEMINI_API_KEY (recomendado) u OPENAI_API_KEY para el asesor de casos',
  );
}

async function chatOpenAi(args: {
  system: string;
  messages: AsesorTurnMessage[];
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature ?? 0.3,
      max_tokens: args.maxTokens ?? 4096,
      response_format: args.jsonMode ? { type: 'json_object' } : undefined,
      messages: [
        { role: 'system', content: args.system },
        ...args.messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI chat ${res.status}: ${body.slice(0, 280)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI no devolvió contenido');
  return text;
}

async function chatModel(args: {
  system: string;
  messages: AsesorTurnMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<{ text: string; model: string; provider: 'openai' | 'gemini' }> {
  const { model, provider } = resolveChatModel();
  if (provider === 'gemini') {
    const history = args.messages.slice(0, -1).map((m) => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      text: m.content,
    }));
    const last = args.messages[args.messages.length - 1];
    const text = await geminiGenerateText({
      model,
      systemInstruction: args.system,
      history,
      prompt: last?.content ?? '',
      temperature: args.temperature ?? 0.3,
      maxOutputTokens: args.maxTokens ?? 4096,
      responseMimeType: args.jsonMode ? 'application/json' : 'text/plain',
    });
    return { text, model, provider };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim() || '';
  const text = await chatOpenAi({
    system: args.system,
    messages: args.messages,
    model,
    apiKey: openaiKey,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
    jsonMode: args.jsonMode,
  });
  return { text, model, provider };
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('No se pudo parsear JSON del modelo');
}

function strField(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === 'string' ? v.trim() : '';
}

function countAssistantQuestions(messages: AsesorTurnMessage[]): number {
  return messages.filter((m) => m.role === 'assistant').length;
}

function userWantsDictamen(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\bdictamin/i.test(t) ||
    /\bdictamen\b/i.test(t) ||
    /\bya (es |está )?suficiente\b/i.test(t) ||
    /\bsin más preguntas\b/i.test(t) ||
    /\bresponde (ya|ahora)\b/i.test(t)
  );
}

function hitsToFragments(hits: LegalKnowledgeHit[]): ContextoLegalFragmento[] {
  return hits.map((h, i) => ({
    index: i + 1,
    content: h.content,
    referencia: h.referencia,
    source: h.source,
    categoria: h.categoria,
    tipo: h.tipo,
    jurisdiccion: h.jurisdiccion,
    similarity: h.similarity,
  }));
}

function formatDictamenMarkdown(d: DictamenJson): string {
  return [
    '## Hechos asumidos',
    d.hechos_asumidos?.trim() || '—',
    '',
    '## Análisis jurídico',
    d.analisis_juridico?.trim() || '—',
    '',
    '## Normativa aplicable',
    d.normativa?.trim() || '—',
    '',
    '## Jurisprudencia / precedentes',
    d.jurisprudencia?.trim() ||
      'No se recuperó jurisprudencia específica en la base de conocimiento para este caso.',
    '',
    '## Recomendación práctica',
    d.recomendacion?.trim() || '—',
    '',
    '## Vista de la contraparte (abogado contrario)',
    d.vista_contraparte?.trim() || '—',
    '',
    '## Réplica sugerida',
    d.replica_sugerida?.trim() || '—',
    '',
    '## Lagunas e incertidumbre',
    d.lagunas_e_incertidumbre?.trim() || '—',
  ].join('\n');
}

function normalizeCategoria(
  raw: string | null | undefined,
  fallback: string | null,
): string | null {
  const c = (raw || fallback || '').trim().toLowerCase();
  return esCategoriaAsesor(c) ? c : fallback && esCategoriaAsesor(fallback) ? fallback : null;
}

function normalizeSubmodulo(
  categoria: string | null,
  raw: string | null | undefined,
  fallback: string | null,
): string | null {
  const s = (raw || fallback || '').trim();
  if (categoria && esSubmoduloDeCategoria(categoria, s)) return s;
  if (categoria && fallback && esSubmoduloDeCategoria(categoria, fallback)) return fallback;
  return s || null;
}

async function emitirDictamen(args: {
  supabase: SupabaseClient;
  messages: AsesorTurnMessage[];
  categoria: string | null;
  submodulo: string | null;
  hechosConsolidados: string;
}): Promise<AsesorCasoTurnResult> {
  const caseBrief = buildCaseBrief({
    categoria: args.categoria,
    submodulo: args.submodulo,
    submoduloLabel: submoduloLabel(args.categoria, args.submodulo),
    hechosConsolidados: args.hechosConsolidados,
    messages: args.messages,
  });

  const ragQuery = [
    args.hechosConsolidados,
    ...args.messages.filter((m) => m.role === 'user').map((m) => m.content),
    args.categoria ? `categoría ${args.categoria}` : '',
    args.submodulo ? `submódulo ${args.submodulo}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 6000);

  const hits = await searchLegalKnowledge(args.supabase, ragQuery || caseBrief, {
    categoryFilter: args.categoria,
    matchThreshold: 0.62,
    matchCount: 8,
  });

  const fragments = hitsToFragments(hits);
  const context = formatContextoLegal(fragments);
  const system = formatDictamenSystemPrompt({ context, case_brief: caseBrief });

  const { text, model, provider } = await chatModel({
    system,
    messages: [
      {
        role: 'user',
        content:
          'Con el expediente y el contexto legal, genera el dictamen JSON completo con vista de contraparte.',
      },
    ],
    temperature: 0.25,
    maxTokens: 5120,
    jsonMode: true,
  });

  const parsed = extractJsonObject(text) as DictamenJson;
  const secciones: AsesorDictamenSecciones = {
    hechos_asumidos: parsed.hechos_asumidos?.trim() || '',
    analisis_juridico: parsed.analisis_juridico?.trim() || '',
    normativa: parsed.normativa?.trim() || '',
    jurisprudencia: parsed.jurisprudencia?.trim() || '',
    recomendacion: parsed.recomendacion?.trim() || '',
    vista_contraparte: parsed.vista_contraparte?.trim() || '',
    replica_sugerida: parsed.replica_sugerida?.trim() || '',
    lagunas_e_incertidumbre: parsed.lagunas_e_incertidumbre?.trim() || '',
    texto_completo: formatDictamenMarkdown(parsed),
  };

  const mensajeIntro =
    'Dictamen listo. Incluye normativa, jurisprudencia recuperada (si hay), recomendación y la vista del abogado de la contraparte.';

  return {
    fase: 'dictamen',
    mensaje: mensajeIntro,
    categoria: args.categoria,
    submodulo: args.submodulo,
    submodulo_label: submoduloLabel(args.categoria, args.submodulo),
    preguntas_hechas: countAssistantQuestions(args.messages),
    preguntas_objetivo: ASESOR_MAX_PREGUNTAS,
    hechos_consolidados: args.hechosConsolidados,
    dictamen: secciones,
    fuentes: hits.map((h, i) => ({
      index: i + 1,
      id: h.id,
      referencia: h.referencia,
      source: h.source,
      categoria: h.categoria,
      tipo: h.tipo,
      similarity: h.similarity,
      excerpt: h.content.slice(0, 280),
    })),
    model,
    provider,
  };
}

/**
 * Un turno del asesor de casos: entrevista (pregunta) o dictamen final con RAG.
 */
export async function procesarTurnoAsesorCaso(
  supabase: SupabaseClient,
  input: {
    messages: AsesorTurnMessage[];
    categoria?: string | null;
    submodulo?: string | null;
    hechos_consolidados?: string | null;
    forzar_dictamen?: boolean;
  },
): Promise<AsesorCasoTurnResult> {
  const messages = (input.messages ?? [])
    .map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(m.content ?? '').trim(),
    }))
    .filter((m) => m.content);

  if (!messages.length || messages[messages.length - 1]?.role !== 'user') {
    throw new Error('Se requiere al menos un mensaje del usuario al final del historial');
  }

  let categoria = normalizeCategoria(input.categoria, null);
  let submodulo = normalizeSubmodulo(categoria, input.submodulo, null);
  let hechos = (input.hechos_consolidados ?? '').trim();
  const preguntasPrevias = countAssistantQuestions(messages);
  const lastUser = messages[messages.length - 1]!.content;
  const forzar =
    Boolean(input.forzar_dictamen) ||
    userWantsDictamen(lastUser) ||
    preguntasPrevias >= ASESOR_MAX_PREGUNTAS;

  if (forzar && (preguntasPrevias > 0 || messages.some((m) => m.role === 'user'))) {
    // Si aún no hay hechos, consolida con el historial
    if (!hechos) {
      hechos = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n');
    }
    return emitirDictamen({
      supabase,
      messages,
      categoria,
      submodulo,
      hechosConsolidados: hechos,
    });
  }

  const catalogHint = [
    categoria ? `Categoría fijada por el cliente: ${categoria}.` : 'Clasifica la categoría.',
    submodulo
      ? `Submódulo fijado por el cliente: ${submodulo}.`
      : 'Elige el submódulo más cercano del catálogo.',
    `Preguntas ya hechas por el abogado: ${preguntasPrevias} de ${ASESOR_MAX_PREGUNTAS}.`,
    `Mínimo orientativo para dictaminar: ${ASESOR_MIN_PREGUNTAS_DICTAMEN}.`,
    hechos ? `Hechos consolidados previos:\n${hechos}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const entrevistaMessages: AsesorTurnMessage[] = [
    {
      role: 'user',
      content: `${catalogHint}\n\n---\nHistorial:\n${messages
        .map((m) => `${m.role === 'user' ? 'Cliente' : 'Abogado'}: ${m.content}`)
        .join('\n\n')}\n\nDevuelve el JSON del siguiente paso.`,
    },
  ];

  const { text, model, provider } = await chatModel({
    system: ASESOR_ENTREVISTA_SYSTEM,
    messages: entrevistaMessages,
    temperature: 0.35,
    maxTokens: 2048,
    jsonMode: true,
  });

  let parsed: EntrevistaJson;
  try {
    parsed = extractJsonObject(text) as EntrevistaJson;
  } catch {
    // Fallback: tratar el texto como pregunta
    parsed = {
      accion: 'preguntar',
      mensaje: text.slice(0, 800),
      hechos_consolidados: hechos,
      categoria,
      submodulo,
    };
  }

  categoria = normalizeCategoria(parsed.categoria, categoria);
  submodulo = normalizeSubmodulo(categoria, parsed.submodulo, submodulo);
  hechos = (parsed.hechos_consolidados || hechos || lastUser).trim();

  const accion = String(parsed.accion || 'preguntar').toLowerCase();
  const alcanzaTope = preguntasPrevias >= ASESOR_MAX_PREGUNTAS;
  const modeloListo =
    accion === 'dictaminar' && preguntasPrevias >= ASESOR_MIN_PREGUNTAS_DICTAMEN;

  if (alcanzaTope || modeloListo) {
    return emitirDictamen({
      supabase,
      messages,
      categoria,
      submodulo,
      hechosConsolidados: hechos,
    });
  }

  const pregunta =
    parsed.mensaje?.trim() ||
    '¿Puede precisar fechas, documentos disponibles y qué resultado busca en este asunto?';

  return {
    fase: 'pregunta',
    mensaje: pregunta,
    categoria,
    submodulo,
    submodulo_label: submoduloLabel(categoria, submodulo),
    preguntas_hechas: preguntasPrevias + 1,
    preguntas_objetivo: ASESOR_MAX_PREGUNTAS,
    hechos_consolidados: hechos,
    dictamen: null,
    fuentes: [],
    model,
    provider,
  };
}
