import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';
import { buscarArchivos } from './storage/index.js';
import {
  isCasaDatosConfigured,
  listarObras,
  resumenObra,
  buscarObraPorNombre,
} from './casaDatos.js';
import { getObraChat, setObraChat } from './obraMemoria.js';
import { buildIcsEvent, guardarIcsEnIcloud } from './calendario.js';

const SYSTEM_BASE = `Eres el asistente ejecutivo personal de Casa Inteligente (construcción en Venezuela).
Actúas con criterio: resumes, propones siguientes pasos y redactas textos listos para enviar.
Capacidades:
- Redactar correos, mensajes, actas, cotizaciones y recordatorios en español claro (Markdown).
- Buscar archivos en la nube con buscarArchivos.
- Consultar obras y resumen de compras reales con listarObras / resumenObraActiva / fijarObraActiva.
- Crear citas de agenda con crearCita (genera .ics para iPhone/Apple Calendar).
- Entender texto, nota de voz transcrita e imágenes.
Zona horaria por defecto del usuario: America/Caracas (UTC-4). Al crear citas usa ISO 8601 con offset -04:00.
Límites:
- Usa herramientas para datos reales; no inventes stock, facturas ni saldos.
- Si falta un dato clave (fecha/hora de una cita), pregunta una sola pregunta concreta.
Responde en español, directo y útil.`;

const tools = {
  functionDeclarations: [
    {
      name: 'buscarArchivos',
      description:
        'Busca archivos en la nube (iCloud/Drive/OneDrive) cuando el usuario lo pida.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Nombre o palabra clave' },
          provider: {
            type: Type.STRING,
            description: 'drive | onedrive | icloud (opcional)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'listarObras',
      description: 'Lista obras/proyectos de Casa Inteligente. Opcional filtrar por nombre.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          filtro: { type: Type.STRING, description: 'Texto a buscar en el nombre' },
        },
      },
    },
    {
      name: 'fijarObraActiva',
      description:
        'Fija la obra activa del chat (memoria). Usar cuando el usuario elija una obra por nombre.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING, description: 'Nombre o parte del nombre de la obra' },
        },
        required: ['nombre'],
      },
    },
    {
      name: 'resumenObraActiva',
      description:
        'Resumen contable de la obra activa (o de un proyecto_id): totales y últimas compras.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          proyecto_id: {
            type: Type.STRING,
            description: 'UUID de la obra. Si vacío, usa la obra activa del chat.',
          },
        },
      },
    },
    {
      name: 'crearCita',
      description:
        'Crea un evento de agenda (.ics) para el iPhone/Apple Calendar. Usar cuando el usuario pida agendar, citar, reunión o recordatorio con fecha/hora.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING, description: 'Título de la cita' },
          inicio_iso: {
            type: Type.STRING,
            description:
              'Inicio en ISO 8601 con zona, ej. 2026-07-22T10:00:00-04:00 (Caracas)',
          },
          fin_iso: {
            type: Type.STRING,
            description: 'Fin en ISO 8601 (opcional si hay duracion_minutos)',
          },
          duracion_minutos: {
            type: Type.NUMBER,
            description: 'Duración en minutos si no hay fin_iso (default 60)',
          },
          ubicacion: { type: Type.STRING, description: 'Lugar (opcional)' },
          notas: { type: Type.STRING, description: 'Notas / descripción (opcional)' },
        },
        required: ['titulo', 'inicio_iso'],
      },
    },
  ],
};

let client;

function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiApiKey() });
  return client;
}

function toContents(chatHistory, userMessage) {
  const contents = (chatHistory || []).map((t) => {
    if (t?.parts) return { role: t.role, parts: t.parts };
    return { role: t.role, parts: [{ text: String(t?.text || '') }] };
  });
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  return contents;
}

function formatSearchResults(query, resultados) {
  if (!resultados.length) {
    return `No encontré ningún archivo que coincida con "${query}".`;
  }
  let texto = `He encontrado los siguientes archivos:\n`;
  for (const file of resultados) {
    const label = file.provider ? `[${file.provider}] ` : '';
    const name = file.name || '(sin nombre)';
    if (file.webViewLink) {
      texto += `- 📄 ${label}[${name}](${file.webViewLink})\n`;
    } else {
      texto += `- 📄 ${label}${name}${file.id ? ` (\`${file.id}\`)` : ''}\n`;
    }
  }
  return texto.trim();
}

/**
 * @returns {Promise<{ text: string, ics?: { fileName: string, buffer: Buffer, mimeType: string } }>}
 */
async function runTool(name, args, chatId) {
  if (name === 'buscarArchivos') {
    const query = String(args.query || '').trim();
    const provider = args.provider ? String(args.provider).trim() : '';
    const resultados = await buscarArchivos(query, provider);
    return { text: formatSearchResults(query, resultados) };
  }

  if (name === 'listarObras') {
    if (!isCasaDatosConfigured()) {
      return { text: 'Supabase no está configurado en el asistente (.env).' };
    }
    const r = await listarObras(String(args.filtro || ''));
    if (!r.ok) return { text: `Error: ${r.error}` };
    if (!r.obras.length) return { text: 'No hay obras que coincidan.' };
    return {
      text: r.obras
        .map((o, i) => `${i + 1}. ${o.nombre}${o.codigo ? ` (${o.codigo})` : ''} · \`${o.id}\``)
        .join('\n'),
    };
  }

  if (name === 'fijarObraActiva') {
    if (!chatId) return { text: 'No hay chatId para guardar memoria.' };
    if (!isCasaDatosConfigured()) return { text: 'Supabase no configurado.' };
    const r = await buscarObraPorNombre(String(args.nombre || ''));
    if (!r.ok) return { text: r.error };
    setObraChat(chatId, r.obra);
    let extra = '';
    if (r.candidatas && r.candidatas.length > 1) {
      extra = `\nOtras coincidencias: ${r.candidatas
        .slice(1)
        .map((c) => c.nombre)
        .join(', ')}`;
    }
    return { text: `Obra activa: *${r.obra.nombre}* (\`${r.obra.id}\`).${extra}` };
  }

  if (name === 'resumenObraActiva') {
    if (!isCasaDatosConfigured()) return { text: 'Supabase no configurado.' };
    let proyectoId = String(args.proyecto_id || '').trim();
    if (!proyectoId && chatId) {
      const obra = getObraChat(chatId);
      if (obra) proyectoId = obra.id;
    }
    if (!proyectoId) {
      return {
        text: 'No hay obra activa. Pide listar obras o fija una con fijarObraActiva / comando /obra.',
      };
    }
    const r = await resumenObra(proyectoId);
    if (!r.ok) return { text: `Error: ${r.error}` };
    const lineas = (r.ultimas || [])
      .slice(0, 8)
      .map(
        (u) =>
          `- ${u.fecha || '—'} · ${u.proveedor || '—'} · ${u.factura || '—'} · $${Number(u.usd).toFixed(2)}`,
      )
      .join('\n');
    return {
      text: [
        `Obra: *${r.obra.nombre}*`,
        `Compras registradas: ${r.compras_registradas}`,
        `Suma de la muestra (últimas ${r.muestra_ultimas}): USD ${r.suma_muestra_usd} · VES ${r.suma_muestra_ves}`,
        lineas ? `Últimas:\n${lineas}` : 'Sin compras recientes.',
      ].join('\n'),
    };
  }

  if (name === 'crearCita') {
    try {
      const ics = buildIcsEvent({
        titulo: String(args.titulo || 'Cita'),
        inicioIso: String(args.inicio_iso || ''),
        finIso: args.fin_iso ? String(args.fin_iso) : undefined,
        duracionMinutos: args.duracion_minutos != null ? Number(args.duracion_minutos) : 60,
        ubicacion: args.ubicacion ? String(args.ubicacion) : undefined,
        notas: args.notas ? String(args.notas) : undefined,
      });
      let iCloudPath = null;
      try {
        iCloudPath = await guardarIcsEnIcloud(ics);
      } catch (e) {
        console.warn('[crearCita] iCloud', e);
      }
      const inicioLocal = new Date(ics.inicio).toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
      });
      const finLocal = new Date(ics.fin).toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
      });
      const text = [
        `Cita creada: *${ics.titulo}*`,
        `Inicio: ${inicioLocal}`,
        `Fin: ${finLocal}`,
        iCloudPath ? `También guardada en iCloud (Agenda).` : null,
        `Abre el archivo .ics en el iPhone para agregarla a tu agenda.`,
      ]
        .filter(Boolean)
        .join('\n');
      return {
        text,
        ics: {
          fileName: ics.fileName,
          buffer: ics.buffer,
          mimeType: ics.mimeType,
        },
      };
    } catch (e) {
      return { text: `No pude crear la cita: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  return { text: `Herramienta desconocida: ${name}` };
}

/**
 * @param {unknown[]} chatHistory
 * @param {string} userMessage
 * @param {{ chatId?: string|number }} [opts]
 */
export async function explicarOEjecutar(chatHistory, userMessage, opts = {}) {
  const chatId = opts.chatId != null ? String(opts.chatId) : null;
  const obra = chatId ? getObraChat(chatId) : null;
  const system = [
    SYSTEM_BASE,
    obra
      ? `Obra activa en este chat: ${obra.nombre} (id ${obra.id}). Úsala por defecto en resumenObraActiva.`
      : 'No hay obra activa. Si preguntan por números de una obra, lista o fija una primero.',
    isCasaDatosConfigured()
      ? 'Datos reales de Casa Inteligente (Supabase) disponibles.'
      : 'Datos Casa Inteligente no configurados (faltan claves Supabase).',
  ].join('\n');

  let contents = toContents(chatHistory, userMessage);
  let lastText = '';
  /** @type {{ fileName: string, buffer: Buffer, mimeType: string } | undefined} */
  let lastIcs;

  for (let round = 0; round < 3; round++) {
    const response = await getClient().models.generateContent({
      model: env.geminiModel(),
      contents,
      config: {
        systemInstruction: system,
        tools: [tools],
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    });

    const functionCalls = response.functionCalls;
    if (functionCalls?.length) {
      const call = functionCalls[0];
      const args = call.args || {};
      const toolResult = await runTool(call.name, args, chatId);
      const toolText = toolResult.text;
      if (toolResult.ics) lastIcs = toolResult.ics;
      if (
        round === 0 &&
        [
          'buscarArchivos',
          'listarObras',
          'fijarObraActiva',
          'resumenObraActiva',
          'crearCita',
        ].includes(call.name)
      ) {
        return { text: toolText, ics: toolResult.ics };
      }
      contents = [
        ...contents,
        { role: 'model', parts: [{ functionCall: { name: call.name, args } }] },
        {
          role: 'user',
          parts: [{ functionResponse: { name: call.name, response: { result: toolText } } }],
        },
      ];
      lastText = toolText;
      continue;
    }

    const text = (response.text || '').trim() || lastText || 'No pude generar una respuesta.';
    return { text, ics: lastIcs };
  }

  return { text: lastText || 'No pude completar la solicitud.', ics: lastIcs };
}

export async function transcribirAudio(buffer, mimeType = 'audio/ogg') {
  const b64 = buffer.toString('base64');
  const response = await getClient().models.generateContent({
    model: env.geminiModel(),
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
}

export async function analizarImagen(buffer, mimeType, instruccion) {
  const b64 = buffer.toString('base64');
  const mime = (mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
  const pedido =
    instruccion?.trim() ||
    'Describe la imagen en español: qué es, datos legibles (montos, fechas, proveedor, obra) y 2-3 acciones sugeridas.';

  const response = await getClient().models.generateContent({
    model: env.geminiModel(),
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
      systemInstruction: SYSTEM_BASE,
      temperature: 0.35,
      maxOutputTokens: 2048,
    },
  });

  return (response.text || '').trim() || 'No pude analizar la imagen.';
}

export async function noteAboutFile(meta) {
  const prompt = [
    `El usuario subió "${meta.fileName}" (${meta.mimeType}).`,
    meta.hint ? `Contexto: ${meta.hint}` : '',
    'Confirma el guardado y sugiere en 2-4 viñetas cómo catalogarlo. No inventes el contenido si no lo viste.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await getClient().models.generateContent({
    model: env.geminiModel(),
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_BASE,
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  });

  return (response.text || '').trim();
}
