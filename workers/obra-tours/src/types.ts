export type FuenteCaptura = 'celular' | 'dron';
export type CalidadReconstruccion = 'rapida' | 'detallada';

export type ReconstructRequest = {
  job_id: string;
  proyecto_id: string;
  video_url: string;
  fuente_captura: FuenteCaptura;
  calidad: CalidadReconstruccion;
  callback_url: string;
  callback_token: string;
};

export type CallbackEstado = 'procesando' | 'modelo_listo' | 'error';

export type WorkerCallbackBody = {
  job_id: string;
  estado: CallbackEstado;
  progreso_pct?: number;
  mensaje_estado?: string;
  error_codigo?: string;
  error_detalle?: string;
  modelo?: {
    formato: 'glb' | 'gltf' | 'splat' | 'ply';
    url: string;
    storage_bucket?: string;
    storage_path?: string;
  };
  result?: Record<string, unknown>;
};

export type PipelineName = 'frames_glb' | 'colmap';
