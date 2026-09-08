import { Anthropic } from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_PROCUREMENT_DEFAULT_MODEL } from '@/lib/almacen/geminiProcurementModels';
import { leerTextoDocumentoLegalCompleto } from '@/lib/legal/leerTextoDocumentoLegal';
import { subirArchivoFlota } from '@/lib/flota/acceso';
import { esMigracionPendiente, partirTextoEnChunks, puntuacionBusqueda } from '@/lib/flota/utils';

export type FlotaManual = {
  id: string;
  titulo: string;
  vehiculo_marca: string | null;
  vehiculo_modelo: string | null;
  archivo_url: string | null;
  archivo_nombre: string | null;
  created_at: string;
  chunks?: number;
};

export type IndexacionManual = {
  indexed: boolean;
  chunks: number;
  manual_id?: string;
};

export type FragmentoManual = {
  id: string;
  manual_id: string;
  contenido: string;
  titulo?: string | null;
  vehiculo_marca?: string | null;
  vehiculo_modelo?: string | null;
  score: number;
};

export async function listarManuales(
  supabase: SupabaseClient,
): Promise<{ items: FlotaManual[]; migracionPendiente: boolean }> {
  const { data, error } = await supabase
    .from('ci_flota_manuales')
    .select('id, titulo, vehiculo_marca, vehiculo_modelo, archivo_url, archivo_nombre, created_at')
    .order('created_at', { ascending: false });
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as FlotaManual[], migracionPendiente: false };
}

export async function buscarFragmentosManual(
  supabase: SupabaseClient,
  pregunta: string,
  limite = 6,
): Promise<FragmentoManual[]> {
  const q = pregunta.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('ci_flota_manual_chunks')
    .select(
      'id, manual_id, contenido, manual:ci_flota_manuales!manual_id (titulo, vehiculo_marca, vehiculo_modelo)',
    )
    .limit(400);

  if (error) {
    if (esMigracionPendiente(error)) return [];
    throw new Error(error.message);
  }

  const scored = (data ?? [])
    .map((row) => {
      const r = row as Record<string, unknown>;
      const manualRaw = r.manual;
      const manual = (Array.isArray(manualRaw) ? manualRaw[0] : manualRaw) as {
        titulo?: string;
        vehiculo_marca?: string | null;
        vehiculo_modelo?: string | null;
      } | null;
      const contenido = String(r.contenido ?? '');
      return {
        id: String(r.id),
        manual_id: String(r.manual_id),
        contenido,
        titulo: manual?.titulo ?? null,
        vehiculo_marca: manual?.vehiculo_marca ?? null,
        vehiculo_modelo: manual?.vehiculo_modelo ?? null,
        score: puntuacionBusqueda(
          `${manual?.titulo ?? ''} ${manual?.vehiculo_marca ?? ''} ${manual?.vehiculo_modelo ?? ''} ${contenido}`,
          q,
        ),
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);

  return scored;
}

export function construirPromptMecanico(contexto_manual?: string): string {
  return `Eres un mecánico experto especializado en mantenimiento de maquinaria pesada y camiones.
Tu objetivo es responder preguntas técnicas sobre:
- Cambios de aceite y filtros
- Mantenimiento de llantas
- Reparaciones de motor
- Sistemas de combustible
- Mantenimiento preventivo

Responde en español, concreto y práctico. Si el síntoma es grave (frenos, dirección, sobrecalentamiento), indica detener la unidad.

${contexto_manual ? `Basándote en el siguiente manual:\n${contexto_manual}` : ''}

Si no sabes la respuesta específica, sugiere contactar a un taller profesional.`;
}

async function responderConGemini(pregunta: string, contexto_manual?: string): Promise<string | null> {
  if (!getGeminiApiKey()) return null;
  const model =
    process.env.GEMINI_FLOTA_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL;
  return geminiGenerateText({
    model,
    temperature: 0.25,
    maxOutputTokens: 1200,
    systemInstruction: construirPromptMecanico(contexto_manual),
    prompt: pregunta,
  });
}

export async function responderPreguntaMecanica(
  pregunta: string,
  contexto_manual?: string,
): Promise<string> {
  const q = pregunta.trim();
  if (!q) throw new Error('pregunta requerida');

  const system_prompt = construirPromptMecanico(contexto_manual);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (apiKey) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const message = await anthropic.messages.create({
        model: process.env.ANTHROPIC_FLOTA_MODEL?.trim() || 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: q }],
        system: system_prompt,
      });
      const block = message.content[0];
      if (block?.type === 'text' && block.text.trim()) return block.text;
    } catch {
      const fallback = await responderConGemini(q, contexto_manual);
      if (fallback) return fallback;
      return 'Error al procesar';
    }
  }

  const gemini = await responderConGemini(q, contexto_manual);
  if (gemini) return gemini;

  if (contexto_manual?.trim()) {
    return `Sin ANTHROPIC_API_KEY ni GEMINI_API_KEY. Contexto del manual:\n\n${contexto_manual.slice(0, 1200)}`;
  }
  return 'No hay ANTHROPIC_API_KEY ni GEMINI_API_KEY. Configure una clave o cargue un manual para el mecánico.';
}

export async function indexarManualPDF(contenido_texto: string): Promise<IndexacionManual> {
  const texto = contenido_texto.trim();
  if (texto.length < 40) {
    throw new Error('El manual no tiene texto suficiente. Suba un PDF legible o pegue el texto.');
  }

  const supabase = await createServerClient();
  const primeraLinea = texto.split('\n').map((l) => l.trim()).find(Boolean) ?? 'Manual PDF';
  const chunks = partirTextoEnChunks(texto);

  const { data, error } = await supabase
    .from('ci_flota_manuales')
    .insert({
      titulo: primeraLinea.slice(0, 180),
      archivo_nombre: 'manual.pdf',
      texto_extraido: texto.slice(0, 200_000),
    })
    .select('id')
    .single();
  if (error) throw error;

  if (chunks.length) {
    const { error: chunkErr } = await supabase.from('ci_flota_manual_chunks').insert(
      chunks.map((contenido, chunk_index) => ({
        manual_id: data.id,
        chunk_index,
        contenido,
      })),
    );
    if (chunkErr) throw chunkErr;
  }

  return { indexed: true, chunks: chunks.length, manual_id: data.id };
}

export async function responderPreguntaMecanico(
  supabase: SupabaseClient,
  pregunta: string,
): Promise<{ respuesta: string; fuentes: FragmentoManual[]; sinManuales: boolean }> {
  const q = pregunta.trim();
  if (q.length < 4) throw new Error('Escriba una pregunta más específica (mínimo 4 caracteres).');

  const fuentes = await buscarFragmentosManual(supabase, q);
  const contexto = fuentes
    .map(
      (f, i) =>
        `[${i + 1}] ${f.titulo ?? 'Manual'}${f.vehiculo_marca ? ` (${f.vehiculo_marca} ${f.vehiculo_modelo ?? ''})` : ''}:\n${f.contenido}`,
    )
    .join('\n\n---\n\n');

  const respuesta = await responderPreguntaMecanica(q, contexto || undefined);
  return { respuesta, fuentes, sinManuales: fuentes.length === 0 };
}

export async function cargarManualFlota(
  supabase: SupabaseClient,
  params: {
    titulo: string;
    vehiculoMarca?: string | null;
    vehiculoModelo?: string | null;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    textoPegado?: string;
  },
): Promise<{ manual: FlotaManual; chunks: number }> {
  const titulo = params.titulo.trim();
  if (!titulo) throw new Error('título requerido');

  let texto = (params.textoPegado ?? '').trim();
  if (!texto) {
    const extraido = await leerTextoDocumentoLegalCompleto(
      params.buffer,
      params.fileName,
      params.mimeType || 'application/octet-stream',
    );
    texto = extraido.texto.trim();
  }
  if (texto.length < 40) {
    throw new Error('El manual no tiene texto suficiente. Suba un .txt/.md o un PDF legible.');
  }

  const safeName = params.fileName.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  const path = `manuales/${Date.now()}-${safeName}`;
  let archivoUrl: string | null = null;
  try {
    archivoUrl = await subirArchivoFlota(supabase, {
      path,
      buffer: params.buffer,
      contentType: params.mimeType || 'application/octet-stream',
    });
  } catch {
    archivoUrl = null;
  }

  const { data, error } = await supabase
    .from('ci_flota_manuales')
    .insert({
      titulo: titulo.slice(0, 180),
      vehiculo_marca: params.vehiculoMarca?.trim() || null,
      vehiculo_modelo: params.vehiculoModelo?.trim() || null,
      archivo_url: archivoUrl,
      archivo_nombre: params.fileName.slice(0, 180),
      texto_extraido: texto.slice(0, 200_000),
    })
    .select('id, titulo, vehiculo_marca, vehiculo_modelo, archivo_url, archivo_nombre, created_at')
    .single();
  if (error) throw new Error(error.message);

  const chunks = partirTextoEnChunks(texto);
  if (chunks.length) {
    const { error: chunkErr } = await supabase.from('ci_flota_manual_chunks').insert(
      chunks.map((contenido, chunk_index) => ({
        manual_id: data.id,
        chunk_index,
        contenido,
      })),
    );
    if (chunkErr) throw new Error(chunkErr.message);
  }

  return { manual: data as FlotaManual, chunks: chunks.length };
}

export async function eliminarManual(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('ci_flota_manuales').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
