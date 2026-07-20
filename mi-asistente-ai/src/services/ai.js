import { Type } from '@google/genai';
import { buscarArchivos } from './storage/index.js';
import {
  isCasaDatosConfigured,
  listarObras,
  resumenObra,
  buscarObraPorNombre,
  consultaCco,
  formatConsultaCco,
} from './casaDatos.js';
import { getObraChat, setObraChat } from './obraMemoria.js';
import { buildIcsEvent, guardarIcsEnIcloud } from './calendario.js';
import {
  crearRecordatorio as guardarRecordatorio,
  listarRecordatorios,
  cancelarRecordatorio,
} from './recordatorios.js';
import { redactarActaMarkdown, guardarActa } from './actas.js';
import {
  crearOActualizarChecklist,
  obtenerChecklist,
  marcarItem,
  formatChecklist,
} from './checklist.js';
import {
  chatRound,
  generateText,
  transcribeAudioBuffer,
  analyzeImageBuffer,
  resolveAiProvider,
} from './llm.js';

const SYSTEM_BASE = `Eres el asistente ejecutivo personal de Casa Inteligente (construcción en Venezuela).
Actúas con criterio: resumes, propones siguientes pasos y redactas textos listos para enviar.
Capacidades:
- Redactar correos, mensajes, actas, cotizaciones y recordatorios en español claro (Markdown).
- Buscar archivos en la nube con buscarArchivos.
- Consultar obras y resumen de compras reales con listarObras / resumenObraActiva / fijarObraActiva.
- Consultar CCO (saldo de caja, gastos del mes, top proveedores) con consultaCco.
- Crear citas de agenda con crearCita (genera .ics para iPhone/Apple Calendar).
- Crear recordatorios con crearRecordatorio (el bot te escribe por Telegram a la hora indicada).
- Generar actas de obra con crearActa (desde texto o nota de voz transcrita) → archivo .md.
- Checklist diario de obra con crearChecklist / verChecklist / marcarChecklist.
- Entender texto, nota de voz transcrita e imágenes.
Zona horaria por defecto del usuario: America/Caracas (UTC-4). Al crear citas/recordatorios usa ISO 8601 con offset -04:00.
Límites:
- Usa herramientas para datos reales; no inventes stock, facturas ni saldos.
- Preguntas de saldo / CCO / proveedores / gastos del mes → consultaCco (obra activa).
- Si pide “recuérdame / avísame” → crearRecordatorio. Si pide “agenda / cita en calendario” → crearCita.
- Si pide “acta / minuta / reunión de obra” → crearActa con las notas o transcripción.
- Si pide “checklist / lista de mañana / tareas de obra” → crearChecklist. Para ver o marcar → verChecklist / marcarChecklist.
- Si falta un dato clave (fecha/hora), pregunta una sola pregunta concreta.
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
      name: 'consultaCco',
      description:
        'Consulta CCO de la obra: saldo de caja, ingresos/gastos/admin, top proveedores y gastos por mes. Usar para “saldo”, “cuánto gastamos”, “top proveedores”, “gastos de julio”.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          proyecto_id: {
            type: Type.STRING,
            description: 'UUID de la obra. Si vacío, usa la obra activa del chat.',
          },
          mes: {
            type: Type.STRING,
            description: 'Opcional YYYY-MM para filtrar gastos/proveedores de ese mes (ej. 2026-07)',
          },
          modo: {
            type: Type.STRING,
            description: 'completo | saldo | proveedores | mes (default completo)',
          },
          top_n: {
            type: Type.NUMBER,
            description: 'Cantidad de proveedores top (default 10)',
          },
        },
      },
    },
    {
      name: 'crearCita',
      description:
        'Crea un evento de agenda (.ics) para el iPhone/Apple Calendar. Usar para “agenda/cita en calendario”, NO para “avísame por Telegram”.',
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
    {
      name: 'crearRecordatorio',
      description:
        'Programa un recordatorio: el bot enviará un mensaje de Telegram a esa hora. Usar con “recuérdame / avísame / avísame a las…”.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          texto: {
            type: Type.STRING,
            description: 'Qué recordar (mensaje que recibirá el usuario)',
          },
          cuando_iso: {
            type: Type.STRING,
            description: 'Cuándo avisar, ISO 8601 con zona America/Caracas (-04:00)',
          },
        },
        required: ['texto', 'cuando_iso'],
      },
    },
    {
      name: 'listarRecordatorios',
      description: 'Lista recordatorios pendientes del chat.',
      parameters: { type: Type.OBJECT, properties: {} },
    },
    {
      name: 'crearActa',
      description:
        'Redacta y guarda un acta de obra (.md) a partir de notas o transcripción de voz. Usar con “acta”, “minuta”, “reunión de obra”.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          notas: {
            type: Type.STRING,
            description: 'Notas o transcripción completa para redactar el acta',
          },
          titulo: {
            type: Type.STRING,
            description: 'Título opcional del acta',
          },
        },
        required: ['notas'],
      },
    },
    {
      name: 'crearChecklist',
      description:
        'Crea o agrega ítems al checklist diario de la obra activa. Usar con “checklist”, “lista de mañana”, “tareas de obra”.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.STRING,
            description: 'Ítems separados por coma, ej. “hormigón, acero, visita Dimáquinas”',
          },
          fecha: {
            type: Type.STRING,
            description: 'Fecha YYYY-MM-DD (opcional; default hoy Caracas)',
          },
          reemplazar: {
            type: Type.BOOLEAN,
            description: 'Si true, reemplaza el checklist del día en vez de agregar',
          },
        },
        required: ['items'],
      },
    },
    {
      name: 'verChecklist',
      description: 'Muestra el checklist del día (obra activa).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          fecha: {
            type: Type.STRING,
            description: 'Fecha YYYY-MM-DD opcional',
          },
        },
      },
    },
    {
      name: 'marcarChecklist',
      description:
        'Marca o desmarca un ítem del checklist (por número 1-based, id o texto parcial).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          item: {
            type: Type.STRING,
            description: 'Número (1, 2…), id o parte del texto del ítem',
          },
          hecho: {
            type: Type.BOOLEAN,
            description: 'true = hecho, false = pendiente. Si vacío, alterna.',
          },
          fecha: { type: Type.STRING, description: 'YYYY-MM-DD opcional' },
        },
        required: ['item'],
      },
    },
  ],
};

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
 * @returns {Promise<{
 *   text: string,
 *   ics?: { fileName: string, buffer: Buffer, mimeType: string },
 *   doc?: { fileName: string, buffer: Buffer, mimeType: string },
 * }>}
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

  if (name === 'consultaCco') {
    if (!isCasaDatosConfigured()) return { text: 'Supabase no configurado.' };
    let proyectoId = String(args.proyecto_id || '').trim();
    if (!proyectoId && chatId) {
      const obra = getObraChat(chatId);
      if (obra) proyectoId = obra.id;
    }
    if (!proyectoId) {
      return {
        text: 'No hay obra activa. Fija una con /obra nombre o fijarObraActiva.',
      };
    }
    const modoRaw = String(args.modo || 'completo').trim().toLowerCase();
    const modo = ['completo', 'saldo', 'proveedores', 'mes'].includes(modoRaw)
      ? modoRaw
      : 'completo';
    const mes = args.mes ? String(args.mes).trim() : undefined;
    const topN = args.top_n != null ? Number(args.top_n) : 10;
    const r = await consultaCco(proyectoId, { mes, topN });
    if (!r.ok) return { text: `Error CCO: ${r.error}` };
    const modoFmt = mes && modo === 'completo' ? 'mes' : modo;
    return { text: formatConsultaCco(r, modoFmt) };
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

  if (name === 'crearRecordatorio') {
    if (!chatId) return { text: 'No hay chatId para el recordatorio.' };
    try {
      const row = guardarRecordatorio({
        chatId,
        texto: String(args.texto || ''),
        cuandoIso: String(args.cuando_iso || ''),
      });
      const cuandoLocal = new Date(row.cuandoIso).toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
      });
      return {
        text: [
          `Recordatorio guardado ✅`,
          `*${row.texto}*`,
          `Te avisaré el ${cuandoLocal}`,
          `Id: \`${row.id}\` · /recordatorios para ver pendientes`,
          `_Nota: el bot debe estar corriendo en tu PC para enviarlo._`,
        ].join('\n'),
      };
    } catch (e) {
      return {
        text: `No pude crear el recordatorio: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (name === 'listarRecordatorios') {
    if (!chatId) return { text: 'No hay chatId.' };
    const list = listarRecordatorios(chatId);
    if (!list.length) return { text: 'No tienes recordatorios pendientes.' };
    const lines = list.map((r, i) => {
      const cuando = new Date(r.cuandoIso).toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
      });
      return `${i + 1}. ${cuando} — ${r.texto} (\`${r.id}\`)`;
    });
    return { text: `*Recordatorios pendientes*\n${lines.join('\n')}` };
  }

  if (name === 'crearActa') {
    try {
      const obra = chatId ? getObraChat(chatId) : null;
      const acta = await redactarActaMarkdown({
        notas: String(args.notas || ''),
        titulo: args.titulo ? String(args.titulo) : null,
        obraNombre: obra?.nombre || null,
      });
      const saved = await guardarActa({
        fileName: acta.fileName,
        buffer: acta.buffer,
        chatId: chatId || undefined,
      });
      const preview = acta.markdown.slice(0, 1200);
      const text = [
        `Acta lista: *${acta.titulo}*`,
        `Archivo: \`${acta.fileName}\``,
        saved.iCloudPath ? 'Guardada también en iCloud → Actas.' : 'Guardada en el servidor local del asistente.',
        '',
        '_Vista previa:_',
        preview + (acta.markdown.length > 1200 ? '\n…' : ''),
      ].join('\n');
      return {
        text,
        doc: {
          fileName: acta.fileName,
          buffer: acta.buffer,
          mimeType: acta.mimeType,
        },
      };
    } catch (e) {
      return {
        text: `No pude crear el acta: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (name === 'crearChecklist') {
    if (!chatId) return { text: 'No hay chatId.' };
    try {
      const obra = getObraChat(chatId);
      const row = crearOActualizarChecklist({
        chatId,
        obraId: obra?.id || null,
        obraNombre: obra?.nombre || null,
        fecha: args.fecha ? String(args.fecha) : undefined,
        items: String(args.items || ''),
        reemplazar: Boolean(args.reemplazar),
      });
      return { text: `Checklist actualizado.\n\n${formatChecklist(row)}` };
    } catch (e) {
      return {
        text: `No pude crear el checklist: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (name === 'verChecklist') {
    if (!chatId) return { text: 'No hay chatId.' };
    const obra = getObraChat(chatId);
    const row = obtenerChecklist(chatId, {
      fecha: args.fecha ? String(args.fecha) : undefined,
      obraId: obra?.id || null,
    });
    if (!row) {
      return {
        text: 'No hay checklist para hoy. Ejemplo: checklist hormigón, acero, visita proveedor',
      };
    }
    return { text: formatChecklist(row) };
  }

  if (name === 'marcarChecklist') {
    if (!chatId) return { text: 'No hay chatId.' };
    try {
      const obra = getObraChat(chatId);
      const { checklist, item } = marcarItem(chatId, String(args.item || ''), {
        fecha: args.fecha ? String(args.fecha) : undefined,
        obraId: obra?.id || null,
        hecho: args.hecho != null ? Boolean(args.hecho) : undefined,
      });
      const estado = item.hecho ? 'hecho ✅' : 'pendiente ⬜';
      return {
        text: `Ítem marcado como ${estado}: ${item.texto}\n\n${formatChecklist(checklist)}`,
      };
    } catch (e) {
      return {
        text: `No pude marcar el ítem: ${e instanceof Error ? e.message : String(e)}`,
      };
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
  let providerLabel = '';
  try {
    providerLabel = resolveAiProvider();
  } catch {
    /* resolveAiProvider lanzará al llamar chatRound */
  }
  const system = [
    SYSTEM_BASE,
    obra
      ? `Obra activa en este chat: ${obra.nombre} (id ${obra.id}). Úsala por defecto en resumenObraActiva y consultaCco.`
      : 'No hay obra activa. Si preguntan por números de una obra, lista o fija una primero.',
    isCasaDatosConfigured()
      ? 'Datos reales de Casa Inteligente (Supabase) disponibles.'
      : 'Datos Casa Inteligente no configurados (faltan claves Supabase).',
    providerLabel ? `Motor IA: ${providerLabel}.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  let contents = toContents(chatHistory, userMessage);
  let lastText = '';
  /** @type {{ fileName: string, buffer: Buffer, mimeType: string } | undefined} */
  let lastIcs;
  /** @type {{ fileName: string, buffer: Buffer, mimeType: string } | undefined} */
  let lastDoc;

  for (let round = 0; round < 3; round++) {
    const response = await chatRound({
      system,
      contents,
      toolsBlock: tools,
      temperature: 0.4,
      maxOutputTokens: 2048,
    });

    const functionCalls = response.functionCalls;
    if (functionCalls?.length) {
      const call = functionCalls[0];
      const args = call.args || {};
      const toolResult = await runTool(call.name, args, chatId);
      const toolText = toolResult.text;
      if (toolResult.ics) lastIcs = toolResult.ics;
      if (toolResult.doc) lastDoc = toolResult.doc;
      if (
        round === 0 &&
        [
          'buscarArchivos',
          'listarObras',
          'fijarObraActiva',
          'resumenObraActiva',
          'consultaCco',
          'crearCita',
          'crearRecordatorio',
          'listarRecordatorios',
          'crearActa',
          'crearChecklist',
          'verChecklist',
          'marcarChecklist',
        ].includes(call.name)
      ) {
        return { text: toolText, ics: toolResult.ics, doc: toolResult.doc };
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
    return { text, ics: lastIcs, doc: lastDoc };
  }

  return { text: lastText || 'No pude completar la solicitud.', ics: lastIcs, doc: lastDoc };
}

export async function transcribirAudio(buffer, mimeType = 'audio/ogg') {
  return transcribeAudioBuffer(buffer, mimeType);
}

export async function analizarImagen(buffer, mimeType, instruccion) {
  return analyzeImageBuffer(buffer, mimeType, instruccion, SYSTEM_BASE);
}

export async function noteAboutFile(meta) {
  const prompt = [
    `El usuario subió "${meta.fileName}" (${meta.mimeType}).`,
    meta.hint ? `Contexto: ${meta.hint}` : '',
    'Confirma el guardado y sugiere en 2-4 viñetas cómo catalogarlo. No inventes el contenido si no lo viste.',
  ]
    .filter(Boolean)
    .join('\n');

  return generateText({
    prompt,
    system: SYSTEM_BASE,
    temperature: 0.3,
    maxOutputTokens: 1024,
  });
}
