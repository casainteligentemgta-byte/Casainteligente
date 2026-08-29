import type { SupabaseClient } from '@supabase/supabase-js';
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

  const key = getGeminiApiKey();
  if (!key) {
    if (!fuentes.length) {
      return {
        respuesta:
          'No hay GEMINI_API_KEY ni fragmentos que coincidan. Cargue un manual (.txt/.md) o configure la clave para el mecánico con IA.',
        fuentes,
        sinManuales: true,
      };
    }
    return {
      respuesta: `Sin IA configurada. Fragmentos que coinciden:\n\n${fuentes
        .map((f) => `• ${f.titulo ?? 'Manual'}: ${f.contenido.slice(0, 280)}…`)
        .join('\n\n')}`,
      fuentes,
      sinManuales: false,
    };
  }

  const model =
    process.env.GEMINI_FLOTA_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    GEMINI_PROCUREMENT_DEFAULT_MODEL;

  const respuesta = await geminiGenerateText({
    model,
    temperature: 0.25,
    maxOutputTokens: 1200,
    systemInstruction: `Eres el mecánico de flota de Casa Inteligente (obras en Venezuela).
Responde en español venezolano, concreto y práctico.
Usa SOLO el contexto de manuales si existe. Si no hay contexto, dilo y da una guía general de taller (sin inventar torque, códigos ni piezas específicas).
Si el síntoma es grave (frenos, dirección, sobrecalentamiento), indica detener la unidad y llevarla a taller.`,
    prompt: contexto
      ? `Pregunta del taller:\n${q}\n\nContexto de manuales:\n${contexto}`
      : `Pregunta del taller (sin manual cargado que coincida):\n${q}`,
  });

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
