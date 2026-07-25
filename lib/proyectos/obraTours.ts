/** Tipos y contrato del módulo Tours de obra (video → 3D → DJI / piloto). */

export const FUENTES_CAPTURA = ['celular', 'dron'] as const;
export type FuenteCaptura = (typeof FUENTES_CAPTURA)[number];

export const CALIDADES_RECONSTRUCCION = ['rapida', 'detallada'] as const;
export type CalidadReconstruccion = (typeof CALIDADES_RECONSTRUCCION)[number];

export const ESTADOS_JOB = [
  'pendiente',
  'subiendo',
  'encolado',
  'procesando',
  'modelo_listo',
  'renderizando_tour',
  'listo',
  'error',
  'cancelado',
] as const;
export type EstadoTourJob = (typeof ESTADOS_JOB)[number];

export const ESTADOS_TOUR = ['borrador', 'generando', 'listo', 'error'] as const;
export type EstadoTour = (typeof ESTADOS_TOUR)[number];

export const MODOS_TOUR = ['automatico', 'piloto'] as const;
export type ModoTour = (typeof MODOS_TOUR)[number];

export const EXPORT_LAYOUTS_DJI = [
  '2d',
  'hsbs',
  'fsbs',
  'hou',
  'fou',
  'panorama_2d',
] as const;
export type ExportLayoutDji = (typeof EXPORT_LAYOUTS_DJI)[number];

export type CameraWaypoint = {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  fov?: number;
};

export type ObraTourJob = {
  id: string;
  proyecto_id: string;
  fuente_captura: FuenteCaptura;
  calidad: CalidadReconstruccion;
  estado: EstadoTourJob;
  progreso_pct: number;
  mensaje_estado: string | null;
  error_codigo: string | null;
  error_detalle: string | null;
  video_storage_bucket: string | null;
  video_storage_path: string | null;
  video_public_url: string | null;
  video_duracion_s: number | null;
  video_bytes: number | null;
  modelo_formato: 'glb' | 'gltf' | 'splat' | 'ply' | null;
  modelo_storage_bucket: string | null;
  modelo_storage_path: string | null;
  modelo_public_url: string | null;
  worker_payload: Record<string, unknown>;
  worker_result: Record<string, unknown>;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ObraTour = {
  id: string;
  proyecto_id: string;
  job_id: string | null;
  nombre: string;
  modo: ModoTour;
  estado: EstadoTour;
  camera_path: CameraWaypoint[];
  export_formato: string | null;
  export_layout: ExportLayoutDji | null;
  export_storage_bucket: string | null;
  export_storage_path: string | null;
  export_public_url: string | null;
  export_duracion_s: number | null;
  dji_ready: boolean;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Contrato HTTP que debe cumplir el worker GPU de reconstrucción. */
export type WorkerReconstruccionRequest = {
  job_id: string;
  proyecto_id: string;
  video_url: string;
  fuente_captura: FuenteCaptura;
  calidad: CalidadReconstruccion;
  callback_url: string;
  /** Token opaco para autenticar el callback del worker. */
  callback_token: string;
};

export type WorkerReconstruccionCallback = {
  job_id: string;
  estado: 'procesando' | 'modelo_listo' | 'error';
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

export const JOB_SELECT =
  'id, proyecto_id, fuente_captura, calidad, estado, progreso_pct, mensaje_estado, error_codigo, error_detalle, video_storage_bucket, video_storage_path, video_public_url, video_duracion_s, video_bytes, modelo_formato, modelo_storage_bucket, modelo_storage_path, modelo_public_url, worker_payload, worker_result, created_by, started_at, finished_at, created_at, updated_at';

export const TOUR_SELECT =
  'id, proyecto_id, job_id, nombre, modo, estado, camera_path, export_formato, export_layout, export_storage_bucket, export_storage_path, export_public_url, export_duracion_s, dji_ready, notas, created_by, created_at, updated_at';

export function etiquetaEstadoJob(estado: EstadoTourJob): string {
  switch (estado) {
    case 'pendiente':
      return 'Pendiente';
    case 'subiendo':
      return 'Subiendo video';
    case 'encolado':
      return 'En cola';
    case 'procesando':
      return 'Reconstruyendo 3D';
    case 'modelo_listo':
      return 'Modelo listo';
    case 'renderizando_tour':
      return 'Renderizando tour';
    case 'listo':
      return 'Listo';
    case 'error':
      return 'Error';
    case 'cancelado':
      return 'Cancelado';
    default:
      return estado;
  }
}

export function jobPermitePiloto(job: Pick<ObraTourJob, 'estado' | 'modelo_public_url'>): boolean {
  return Boolean(
    job.modelo_public_url &&
      (job.estado === 'modelo_listo' || job.estado === 'listo' || job.estado === 'renderizando_tour'),
  );
}

export function jobPermiteExportDji(job: Pick<ObraTourJob, 'estado' | 'modelo_public_url'>): boolean {
  return jobPermitePiloto(job);
}

/** Ruta de storage sugerida para videos/modelos/exports del módulo. */
export function pathTourAsset(
  proyectoId: string,
  kind: 'video' | 'modelo' | 'export',
  ext: string,
): string {
  return `ci-proyectos/${proyectoId}/tours/${kind}/${crypto.randomUUID()}.${ext}`;
}
