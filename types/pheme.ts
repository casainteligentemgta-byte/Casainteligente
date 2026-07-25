/** Tipos del agente Pheme (reuniones estratégicas). */

export type ReunionEstado =
  | 'pendiente'
  | 'subida'
  | 'transcribiendo'
  | 'analizando'
  | 'indexando'
  | 'listo'
  | 'error';

export type PhemeViabilidad = 'Alta' | 'Media' | 'Baja' | 'Inviable';

export type PhemeTareaPendiente = {
  tarea: string;
  responsable: string;
  fecha_limite: string;
};

export type PhemeResumenEjecutivo = {
  objetivo_principal: string;
  acuerdos_clave: string[];
  tareas_pendientes: PhemeTareaPendiente[];
};

export type PhemeIdeaViabilidad = {
  idea: string;
  viabilidad: PhemeViabilidad;
  pros: string[];
  contras_riesgos: string[];
  dictamen: string;
};

export type PhemeMatrizViabilidad = {
  ideas_analizadas: PhemeIdeaViabilidad[];
};

export type PhemeAnalisisComunicacion = {
  tono_general: string;
  objeciones_detectadas: string[];
  puntos_de_duda_o_vacilacion: string[];
  recomendacion_seguimiento: string;
};

/** Informe JSON canónico del agente Pheme. */
export type PhemeInforme = {
  resumen_ejecutivo: PhemeResumenEjecutivo;
  matriz_viabilidad: PhemeMatrizViabilidad;
  mapa_mental_mermaid: string;
  analisis_comunicacion: PhemeAnalisisComunicacion;
};

export type ReunionRow = {
  id: string;
  user_id: string;
  titulo: string;
  audio_path: string | null;
  audio_bucket: string;
  mime_type: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  duracion_segundos: number | null;
  estado: ReunionEstado;
  transcripcion_raw: string | null;
  stt_provider: string | null;
  stt_model: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PhemeAnalisisRow = {
  id: string;
  reunion_id: string;
  resumen_ejecutivo: PhemeResumenEjecutivo;
  matriz_viabilidad: PhemeMatrizViabilidad;
  mapa_mental_mermaid: string;
  analisis_comunicacion: PhemeAnalisisComunicacion;
  modelo: string | null;
  raw_response: PhemeInforme | Record<string, unknown> | null;
  created_at: string;
};

export type PhemeEmbeddingHit = {
  id: string;
  reunion_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

export type UploadMeetingAudioResult = {
  reunionId: string;
  audioPath: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type TranscribeMeetingResult = {
  transcript: string;
  provider: 'openai' | 'groq';
  model: string;
  durationSeconds: number | null;
};

export type ProcessMeetingResult = {
  reunionId: string;
  estado: ReunionEstado;
  transcriptLength: number;
  chunksIndexed: number;
  analisisId: string;
  informe: PhemeInforme;
};
