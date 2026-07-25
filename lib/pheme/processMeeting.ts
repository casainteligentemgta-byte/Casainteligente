import type { SupabaseClient } from '@supabase/supabase-js';
import { indexTranscriptEmbeddings } from '@/lib/pheme/embedTranscript';
import { runPhemeAgent } from '@/lib/pheme/runPhemeAgent';
import { REUNIONES_AUDIO_BUCKET } from '@/lib/pheme/constants';
import { transcribeMeetingAudio } from '@/lib/pheme/transcribeMeetingAudio';
import type { ProcessMeetingResult, ReunionRow } from '@/types/pheme';

async function setEstado(
  supabase: SupabaseClient,
  reunionId: string,
  estado: ReunionRow['estado'],
  patch?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('reuniones')
    .update({ estado, ...patch })
    .eq('id', reunionId);
  if (error) throw new Error(error.message);
}

async function downloadAudio(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || 'No se pudo descargar el audio');
  }
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Pipeline completo: STT → Pheme → embeddings.
 */
export async function processMeeting(
  supabase: SupabaseClient,
  reunionId: string,
  options?: {
    preferredSttProvider?: 'openai' | 'groq' | 'auto';
    skipEmbeddings?: boolean;
  },
): Promise<ProcessMeetingResult> {
  const { data: reunion, error: fetchError } = await supabase
    .from('reuniones')
    .select('*')
    .eq('id', reunionId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!reunion) throw new Error('Reunión no encontrada');

  const row = reunion as ReunionRow;
  if (!row.audio_path) {
    throw new Error('La reunión no tiene audio_path; suba el archivo primero');
  }

  try {
    await setEstado(supabase, reunionId, 'transcribiendo', { error_message: null });

    const audio = await downloadAudio(
      supabase,
      row.audio_bucket || REUNIONES_AUDIO_BUCKET,
      row.audio_path,
    );

    const stt = await transcribeMeetingAudio(audio, {
      fileName: row.file_name || 'reunion-audio.webm',
      mimeType: row.mime_type || 'audio/webm',
      preferredProvider: options?.preferredSttProvider ?? 'auto',
      diarize: true,
    });

    await setEstado(supabase, reunionId, 'analizando', {
      transcripcion_raw: stt.transcript,
      stt_provider: stt.provider,
      stt_model: stt.model,
      duracion_segundos: stt.durationSeconds,
    });

    const pheme = await runPhemeAgent(stt.transcript, { titulo: row.titulo });

    const { data: analisisUpsert, error: analisisError } = await supabase
      .from('pheme_analisis')
      .upsert(
        {
          reunion_id: reunionId,
          resumen_ejecutivo: pheme.informe.resumen_ejecutivo,
          matriz_viabilidad: pheme.informe.matriz_viabilidad,
          mapa_mental_mermaid: pheme.informe.mapa_mental_mermaid,
          analisis_comunicacion: pheme.informe.analisis_comunicacion,
          modelo: pheme.modelo,
          raw_response: pheme.informe,
        },
        { onConflict: 'reunion_id' },
      )
      .select('id')
      .single();

    if (analisisError || !analisisUpsert?.id) {
      throw new Error(analisisError?.message || 'No se pudo guardar pheme_analisis');
    }

    let chunksIndexed = 0;
    if (!options?.skipEmbeddings) {
      await setEstado(supabase, reunionId, 'indexando');
      const indexed = await indexTranscriptEmbeddings(supabase, reunionId, stt.transcript);
      chunksIndexed = indexed.chunksIndexed;
    }

    await setEstado(supabase, reunionId, 'listo', { error_message: null });

    return {
      reunionId,
      estado: 'listo',
      transcriptLength: stt.transcript.length,
      chunksIndexed,
      analisisId: analisisUpsert.id as string,
      informe: pheme.informe,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('reuniones')
      .update({ estado: 'error', error_message: message.slice(0, 800) })
      .eq('id', reunionId);
    throw err;
  }
}
