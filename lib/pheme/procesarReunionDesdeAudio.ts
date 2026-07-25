import { procesarReunionConPheme } from '@/lib/pheme/generarMinuta';
import { persistirReunionPheme } from '@/lib/pheme/persistirReunion';
import { transcribirAudioConDiarizacion } from '@/lib/pheme/transcribirAudio';
import type { GenerarMinutaPhemeResult, MinutaPheme } from '@/lib/pheme/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProcesarReunionDesdeAudioResult = GenerarMinutaPhemeResult & {
  id_reunion: number | null;
  transcripcion: string;
  minuta: MinutaPheme;
};

/**
 * Flujo completo del prototipo:
 * Audio → Transcripción con hablantes → Minuta Pheme → PostgreSQL.
 */
export async function procesarReunionDesdeAudio(opts: {
  tituloReunion: string;
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
  duracionMinutos?: number | null;
  supabase?: SupabaseClient | null;
  guardar?: boolean;
}): Promise<ProcesarReunionDesdeAudioResult> {
  const titulo = (opts.tituloReunion ?? '').trim() || 'Sin título';

  const transcripcionRaw = await transcribirAudioConDiarizacion({
    buffer: opts.buffer,
    mimeType: opts.mimeType,
    fileName: opts.fileName,
  });

  const minutaResult = await procesarReunionConPheme(titulo, transcripcionRaw);

  let idReunion: number | null = null;
  let reunionUuid: string | null = null;
  let aviso = minutaResult.aviso;

  if (opts.guardar !== false && opts.supabase) {
    const saved = await persistirReunionPheme(opts.supabase, {
      titulo,
      transcripcion: transcripcionRaw,
      minuta: minutaResult.minuta,
      markdown: minutaResult.markdown,
      modelo: minutaResult.modelo ?? null,
      desdeGemini: minutaResult.desdeGemini,
      duracionMinutos: opts.duracionMinutos ?? null,
    });
    idReunion = saved.idReunion;
    reunionUuid = saved.id;
    if (saved.aviso) {
      aviso = [aviso, saved.aviso].filter(Boolean).join(' ');
    }
  }

  return {
    ...minutaResult,
    aviso,
    reunion_id: reunionUuid,
    id_reunion: idReunion,
    transcripcion: transcripcionRaw,
    minuta: minutaResult.minuta,
  };
}
