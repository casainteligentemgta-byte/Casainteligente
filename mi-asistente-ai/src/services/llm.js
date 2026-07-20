/**
 * Capa LLM: Gemini (Google) o Groq (gratis, Llama).
 * Groq: https://console.groq.com/keys
 */
import { GoogleGenAI } from '@google/genai';
import { env, isRealSecret } from '../config/env.js';

let geminiClient;

function getGemini() {
  const key = env.geminiApiKey();
  if (!isRealSecret(key)) throw new Error('Falta GEMINI_API_KEY válida.');
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: key });
  return geminiClient;
}

function isQuotaError(err) {
  const status = err?.status || err?.code || err?.statusCode;
  const msg = String(err?.message || err || '');
  return (
    status === 429 ||
    status === 503 ||
    /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests|UNAVAILABLE|high demand|Forbidden|403/i.test(
      msg,
    )
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function quotaUserMessage() {
  return (
    'La IA no respondió (cuota, saturación o Forbidden). ' +
    'Si el error es de Groq Forbidden: la key/cuenta no tiene permiso (región o modelo). ' +
    'Prueba sin Groq (borra GROQ_API_KEY) o usa GEMINI_MODEL=gemini-flash-latest. ' +
    'Comandos sin IA: /cco /saldo /checklist /obras.'
  );
}

/**
 * @returns {'groq'|'gemini'}
 */
export function resolveAiProvider() {
  const p = env.aiProvider();
  if (p === 'groq') {
    if (!isRealSecret(env.groqApiKey())) {
      throw Object.assign(new Error('AI_PROVIDER=groq pero falta GROQ_API_KEY'), {
        userMessage:
          'Configura GROQ_API_KEY en mi-asistente-ai/.env (gratis en https://console.groq.com/keys).',
      });
    }
    return 'groq';
  }
  if (p === 'gemini') {
    if (!isRealSecret(env.geminiApiKey())) {
      throw Object.assign(new Error('Falta GEMINI_API_KEY'), {
        userMessage: 'Falta GEMINI_API_KEY en .env, o cambia a AI_PROVIDER=groq con GROQ_API_KEY.',
      });
    }
    return 'gemini';
  }
  // auto: preferir Groq si hay key (más cuota free práctica)
  if (isRealSecret(env.groqApiKey())) return 'groq';
  if (isRealSecret(env.geminiApiKey())) return 'gemini';
  throw Object.assign(new Error('Sin proveedor de IA'), {
    userMessage:
      'No hay IA configurada. Añade GROQ_API_KEY (gratis) o GEMINI_API_KEY en mi-asistente-ai/.env.',
  });
}

/** Convierte tools estilo Gemini → OpenAI/Groq */
export function toOpenAiTools(geminiToolsBlock) {
  const decls = geminiToolsBlock?.functionDeclarations || [];
  return decls.map((d) => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description || '',
      parameters: geminiParamsToJsonSchema(d.parameters || { type: 'OBJECT', properties: {} }),
    },
  }));
}

function geminiParamsToJsonSchema(params) {
  const typeMap = {
    OBJECT: 'object',
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
  };
  const t = String(params.type || 'OBJECT').toUpperCase();
  const out = {
    type: typeMap[t] || 'object',
  };
  if (params.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(params.properties)) {
      out.properties[k] = geminiParamsToJsonSchema(v);
      if (v.description) out.properties[k].description = v.description;
    }
  }
  if (params.required) out.required = params.required;
  if (params.description) out.description = params.description;
  return out;
}

/**
 * Historial Gemini → mensajes OpenAI
 * @param {Array<{ role: string, parts: any[] }>} contents
 */
export function geminiContentsToOpenAiMessages(contents, system) {
  /** @type {Array<{ role: string, content?: string, tool_calls?: any[], tool_call_id?: string, name?: string }>} */
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });

  for (const c of contents || []) {
    const role = c.role === 'model' ? 'assistant' : c.role === 'user' ? 'user' : c.role;
    const parts = c.parts || [];

    const fnCall = parts.find((p) => p.functionCall);
    if (fnCall?.functionCall) {
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: `call_${fnCall.functionCall.name}_${messages.length}`,
            type: 'function',
            function: {
              name: fnCall.functionCall.name,
              arguments: JSON.stringify(fnCall.functionCall.args || {}),
            },
          },
        ],
      });
      continue;
    }

    const fnResp = parts.find((p) => p.functionResponse);
    if (fnResp?.functionResponse) {
      const prev = [...messages].reverse().find((m) => m.tool_calls?.length);
      const callId = prev?.tool_calls?.[0]?.id || `call_${fnResp.functionResponse.name}`;
      messages.push({
        role: 'tool',
        tool_call_id: callId,
        name: fnResp.functionResponse.name,
        content: JSON.stringify(fnResp.functionResponse.response || {}),
      });
      continue;
    }

    const text = parts
      .map((p) => p.text)
      .filter(Boolean)
      .join('\n');
    if (text) messages.push({ role, content: text });
  }
  return messages;
}

async function groqChat({ messages, tools, temperature = 0.4, maxTokens = 2048, model }) {
  const key = env.groqApiKey();
  if (!isRealSecret(key)) {
    throw Object.assign(new Error('Falta GROQ_API_KEY'), {
      userMessage: 'Falta GROQ_API_KEY válida en .env',
      status: 401,
    });
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || env.groqModel(),
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const apiMsg = json?.error?.message || `Groq HTTP ${res.status}`;
    const err = new Error(apiMsg);
    err.status = res.status;
    if (res.status === 403 || /forbidden/i.test(apiMsg)) {
      err.userMessage =
        'Groq respondió Forbidden: la API key no tiene permiso (región, organización o modelo bloqueado). ' +
        'Quita GROQ_API_KEY del .env para usar solo Gemini, o crea otra key / habilita el modelo en console.groq.com.';
    }
    throw err;
  }
  return json;
}

/**
 * Una ronda de chat con tools. Normaliza a { text, functionCalls }.
 * @param {{
 *   system: string,
 *   contents: any[],
 *   toolsBlock: { functionDeclarations: any[] },
 *   temperature?: number,
 *   maxOutputTokens?: number,
 * }} opts
 */
export async function chatRound(opts) {
  const providers = preferredProviders();
  let lastErr;
  for (const provider of providers) {
    try {
      if (provider === 'groq') {
        return await chatRoundGroq(opts);
      }
      return await chatRoundGemini(opts);
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err) && provider === providers[providers.length - 1]) throw wrapErr(err);
      if (!isQuotaError(err) && providers.length === 1) throw wrapErr(err);
      console.warn(`[llm] fallo ${provider}:`, err?.message || err);
      if (isQuotaError(err)) await sleep(800);
    }
  }
  throw wrapErr(lastErr || new Error('IA no disponible'));
}

function preferredProviders() {
  const primary = resolveAiProvider();
  const list = [primary];
  // Si auto/groq falla por cuota, intentar Gemini si hay key (y viceversa)
  if (primary === 'groq' && isRealSecret(env.geminiApiKey())) list.push('gemini');
  if (primary === 'gemini' && isRealSecret(env.groqApiKey())) list.push('groq');
  return list;
}

function wrapErr(err) {
  if (!err) err = new Error('IA no disponible');
  if (isQuotaError(err) && !err.userMessage) err.userMessage = quotaUserMessage();
  return err;
}

async function chatRoundGemini(opts) {
  const models = env.geminiFallbackModels();
  let lastErr;
  for (let i = 0; i < models.length; i++) {
    try {
      const response = await getGemini().models.generateContent({
        model: models[i],
        contents: opts.contents,
        config: {
          systemInstruction: opts.system,
          tools: [opts.toolsBlock],
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: opts.maxOutputTokens ?? 2048,
        },
      });
      return {
        provider: 'gemini',
        text: (response.text || '').trim(),
        functionCalls: response.functionCalls || [],
      };
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err)) throw err;
      console.warn(`[gemini] cuota en ${models[i]}`);
      if (i < models.length - 1) await sleep(1200);
    }
  }
  throw lastErr || new Error('Cuota Gemini agotada');
}

async function chatRoundGroq(opts) {
  const messages = geminiContentsToOpenAiMessages(opts.contents, opts.system);
  const tools = toOpenAiTools(opts.toolsBlock);
  const json = await groqChat({
    messages,
    tools,
    temperature: opts.temperature ?? 0.4,
    maxTokens: opts.maxOutputTokens ?? 2048,
  });
  const choice = json.choices?.[0]?.message || {};
  const toolCalls = choice.tool_calls || [];
  return {
    provider: 'groq',
    text: (choice.content || '').trim(),
    functionCalls: toolCalls.map((tc) => {
      let args = {};
      try {
        args = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        args = {};
      }
      return { name: tc.function?.name, args, id: tc.id };
    }),
  };
}

/**
 * Texto simple (actas, notas) sin tools.
 */
export async function generateText({ prompt, system, temperature = 0.35, maxOutputTokens = 2048 }) {
  const providers = preferredProviders();
  let lastErr;
  for (const provider of providers) {
    try {
      if (provider === 'groq') {
        const json = await groqChat({
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
          maxTokens: maxOutputTokens,
        });
        return (json.choices?.[0]?.message?.content || '').trim();
      }
      const models = env.geminiFallbackModels();
      for (const model of models) {
        try {
          const response = await getGemini().models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              ...(system ? { systemInstruction: system } : {}),
              temperature,
              maxOutputTokens,
            },
          });
          return (response.text || '').trim();
        } catch (err) {
          lastErr = err;
          if (!isQuotaError(err)) throw err;
        }
      }
      throw lastErr || new Error('Gemini falló');
    } catch (err) {
      lastErr = err;
      console.warn(`[llm generateText] ${provider}:`, err?.message || err);
      if (!isQuotaError(err) && providers.length === 1) throw wrapErr(err);
    }
  }
  throw wrapErr(lastErr || new Error('IA no disponible'));
}

/**
 * Transcribe audio: Groq Whisper (gratis) o Gemini.
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
export async function transcribeAudioBuffer(buffer, mimeType = 'audio/ogg') {
  const providers = preferredProviders();
  let lastErr;
  for (const provider of providers) {
    try {
      if (provider === 'groq') {
        return await transcribeGroq(buffer, mimeType);
      }
      return await transcribeGemini(buffer, mimeType);
    } catch (err) {
      lastErr = err;
      console.warn(`[llm transcribe] ${provider}:`, err?.message || err);
    }
  }
  throw wrapErr(lastErr || new Error('No pude transcribir el audio'));
}

async function transcribeGroq(buffer, mimeType) {
  const ext = /webm/i.test(mimeType)
    ? 'webm'
    : /mpeg|mp3/i.test(mimeType)
      ? 'mp3'
      : /wav/i.test(mimeType)
        ? 'wav'
        : 'ogg';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/ogg' }), `audio.${ext}`);
  form.append('model', env.groqWhisperModel());
  form.append('language', 'es');
  form.append('response_format', 'text');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.groqApiKey()}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(text || `Groq whisper HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return String(text || '').trim();
}

async function transcribeGemini(buffer, mimeType) {
  const b64 = buffer.toString('base64');
  const models = env.geminiFallbackModels();
  let lastErr;
  for (const model of models) {
    try {
      const response = await getGemini().models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: mimeType || 'audio/ogg', data: b64 } },
              {
                text:
                  'Transcribe literalmente este audio en español. Solo el texto dicho, sin comentarios ni comillas. Si no se entiende, responde exactamente: (no se entendió)',
              },
            ],
          },
        ],
        config: { temperature: 0.1, maxOutputTokens: 2048 },
      });
      return (response.text || '').trim();
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err)) throw err;
    }
  }
  throw lastErr || new Error('Transcripción Gemini falló');
}

/**
 * Análisis de imagen: Gemini (mejor) o Groq visión si hay.
 */
export async function analyzeImageBuffer(buffer, mimeType, instruccion, system) {
  const pedido =
    instruccion?.trim() ||
    'Describe la imagen en español: qué es, datos legibles (montos, fechas, proveedor, obra) y 2-3 acciones sugeridas.';
  const mime = (mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
  const b64 = buffer.toString('base64');

  // Preferir Gemini para visión si hay key
  if (isRealSecret(env.geminiApiKey())) {
    try {
      const models = env.geminiFallbackModels();
      for (const model of models) {
        try {
          const response = await getGemini().models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: mime, data: b64 } },
                  { text: pedido },
                ],
              },
            ],
            config: {
              ...(system ? { systemInstruction: system } : {}),
              temperature: 0.35,
              maxOutputTokens: 2048,
            },
          });
          const t = (response.text || '').trim();
          if (t) return t;
        } catch (err) {
          if (!isQuotaError(err)) throw err;
        }
      }
    } catch (e) {
      console.warn('[vision gemini]', e?.message || e);
    }
  }

  if (isRealSecret(env.groqApiKey())) {
    const json = await groqChat({
      model: env.groqVisionModel(),
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        {
          role: 'user',
          content: [
            { type: 'text', text: pedido },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${b64}` },
            },
          ],
        },
      ],
      temperature: 0.35,
      maxTokens: 2048,
    });
    return (json.choices?.[0]?.message?.content || '').trim() || 'No pude analizar la imagen.';
  }

  throw Object.assign(new Error('Sin proveedor de visión'), {
    userMessage: 'Para analizar fotos necesitas GEMINI_API_KEY o un modelo visión en Groq.',
  });
}
