/**
 * Técnico de dispositivos (IA): responde preguntas técnicas con el catálogo de
 * NetVision como referencia. Mismo esquema que el mecánico de flota:
 * Anthropic si hay ANTHROPIC_API_KEY, si no Gemini.
 */
import { Anthropic } from '@anthropic-ai/sdk'
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels'
import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client'
import {
  TECNICO_PREGUNTA_MIN,
  construirPromptTecnico,
  normalizarHistorial,
  normalizarPregunta,
  type TecnicoTurno,
} from '@/lib/netvision/tecnicoContexto'

export type TecnicoProveedor = 'anthropic' | 'gemini' | 'ninguno'

export type TecnicoRespuesta = {
  respuesta: string
  proveedor: TecnicoProveedor
}

const ANTHROPIC_TECNICO_DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export const MENSAJE_TECNICO_SIN_CLAVE =
  'El técnico IA no está configurado: falta GEMINI_API_KEY o ANTHROPIC_API_KEY en el servidor.'

async function responderConGemini(
  pregunta: string,
  historial: TecnicoTurno[],
  system: string,
): Promise<string | null> {
  if (!getGeminiApiKey()) return null
  const model =
    process.env.GEMINI_TECNICO_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL
  return geminiGenerateText({
    model,
    temperature: 0.2,
    // Margen amplio: en los modelos 2.5 el razonamiento interno también consume salida.
    maxOutputTokens: 3000,
    systemInstruction: system,
    history: historial.map((t) => ({
      role: t.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: t.text,
    })),
    prompt: pregunta,
  })
}

async function responderConAnthropic(
  apiKey: string,
  pregunta: string,
  historial: TecnicoTurno[],
  system: string,
): Promise<string | null> {
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_TECNICO_MODEL?.trim() || ANTHROPIC_TECNICO_DEFAULT_MODEL,
    max_tokens: 1400,
    system,
    messages: [
      ...historial.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user' as const, content: pregunta },
    ],
  })
  const texto = message.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()
  return texto || null
}

export async function responderPreguntaTecnico(
  preguntaRaw: unknown,
  historialRaw: unknown = [],
): Promise<TecnicoRespuesta> {
  const pregunta = normalizarPregunta(preguntaRaw)
  if (pregunta.length < TECNICO_PREGUNTA_MIN) {
    throw new Error('Escribe una pregunta más específica.')
  }
  const historial = normalizarHistorial(historialRaw)
  const system = construirPromptTecnico()

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (apiKey) {
    try {
      const texto = await responderConAnthropic(apiKey, pregunta, historial, system)
      if (texto) return { respuesta: texto, proveedor: 'anthropic' }
    } catch (err) {
      console.error('[netvision tecnico] anthropic', err)
      // Sigue con Gemini si está disponible.
    }
  }

  const gemini = await responderConGemini(pregunta, historial, system)
  if (gemini) return { respuesta: gemini, proveedor: 'gemini' }

  return { respuesta: MENSAJE_TECNICO_SIN_CLAVE, proveedor: 'ninguno' }
}
