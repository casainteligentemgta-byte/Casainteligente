import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';
import { buscarArchivos } from './storage/index.js';

const SYSTEM = `Eres un asistente ejecutivo avanzado de Casa Inteligente (obras de construcción en Venezuela).
Tienes la capacidad de buscar archivos en la nube y redactar documentos complejos.
Si el usuario pide escribir, redactar o analizar algo, hazlo directamente en texto claro y profesional (Markdown).
Si pide buscar, localizar o encontrar un archivo, usa la herramienta buscarArchivos.
No inventes datos de stock, facturas o nómina: para operaciones reales indica el bot operativo de Casa Inteligente.
Responde en español.`;

const searchFilesTool = {
  functionDeclarations: [
    {
      name: 'buscarArchivos',
      description:
        'Busca archivos específicos en las carpetas autorizadas de la nube (Google Drive, OneDrive, iCloud) cuando el usuario lo solicite.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'El nombre o palabra clave del archivo a buscar.',
          },
          provider: {
            type: Type.STRING,
            description:
              'El proveedor específico si el usuario lo menciona (drive, onedrive, icloud). Si no lo menciona, dejar vacío.',
          },
        },
        required: ['query'],
      },
    },
  ],
};

let client;

function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiApiKey() });
  return client;
}

/**
 * Normaliza historial: acepta `{ role, parts }` o `{ role, text }`.
 * @param {unknown[]} chatHistory
 */
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
      texto += `- ${label}[${name}](${file.webViewLink})\n`;
    } else {
      texto += `- ${label}${name}${file.id ? ` (\`${file.id}\`)` : ''}\n`;
    }
  }
  return texto.trim();
}

/**
 * @param {Array<{ role: string, parts?: Array<{ text: string }>, text?: string }>} chatHistory
 * @param {string} userMessage
 * @returns {Promise<{ text: string }>}
 */
export async function explicarOEjecutar(chatHistory, userMessage) {
  const response = await getClient().models.generateContent({
    model: env.geminiModel(),
    contents: toContents(chatHistory, userMessage),
    config: {
      systemInstruction: SYSTEM,
      tools: [searchFilesTool],
      temperature: 0.45,
      maxOutputTokens: 2048,
    },
  });

  const functionCalls = response.functionCalls;
  if (functionCalls?.length) {
    const call = functionCalls[0];
    if (call.name === 'buscarArchivos') {
      const args = call.args || {};
      const query = String(args.query || '').trim();
      const provider = args.provider ? String(args.provider).trim() : '';
      const resultados = await buscarArchivos(query, provider);
      return { text: formatSearchResults(query, resultados) };
    }
  }

  const text = (response.text || '').trim() || 'No pude generar una respuesta.';
  return { text };
}

/**
 * @param {{ fileName: string, mimeType: string, hint?: string }} meta
 */
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
      systemInstruction: SYSTEM,
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  });

  return (response.text || '').trim();
}
