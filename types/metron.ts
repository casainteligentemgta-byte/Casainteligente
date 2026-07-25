/** Tipos públicos de Metron — cómputo y prepresupuesto desde planos. */

export type MetronDisciplina =
  | 'arq'
  | 'est'
  | 'ele'
  | 'san'
  | 'red'
  | 'cctv'
  | 'mixta'
  | 'desconocida';

export type MetronAnalisisStatus = 'borrador' | 'revisado' | 'aplicado' | 'error';

export type MetronComputoLinea = {
  codigo_sugerido: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario_estimado: number;
  monto_estimado: number;
  capitulo_sugerido: string;
  supuesto: string;
  confianza: number;
  disciplina: MetronDisciplina;
};

export type MetronAnalisisResultado = {
  disciplina: MetronDisciplina;
  especialidades: MetronDisciplina[];
  titulo_plano: string;
  escala_detectada: string;
  resumen: string;
  supuestos: string[];
  alertas: string[];
  computos: MetronComputoLinea[];
};

export type MetronComputoRow = MetronComputoLinea & {
  id: string;
  analisis_id: string;
  orden: number;
  aprobado: boolean;
  partida_id: string | null;
  created_at?: string;
};

export type MetronAnalisisRow = {
  id: string;
  proyecto_id: string;
  plano_archivo_id: string | null;
  disciplina: MetronDisciplina;
  especialidades: MetronDisciplina[];
  titulo_plano: string;
  escala_detectada: string;
  resumen: string;
  supuestos: string[];
  alertas: string[];
  status: MetronAnalisisStatus;
  modelo: string | null;
  archivo_nombre: string;
  mime_type: string;
  public_url: string | null;
  error_mensaje: string | null;
  created_at: string;
  updated_at: string;
  computos?: MetronComputoRow[];
};
