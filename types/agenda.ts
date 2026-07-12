export type CategoriaFechaEspecial = 'birthday' | 'appointment' | 'reminder' | 'holiday';

export interface FechaEspecial {
  id: string;
  user_id: string | null;
  titulo: string;
  categoria: CategoriaFechaEspecial;
  fecha: string;
  hora: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardarFechaEspecialInput {
  titulo: string;
  categoria: CategoriaFechaEspecial;
  fecha: string;
  hora?: string;
  notas?: string;
}

export interface ConsultarFechasEspecialesInput {
  categoria?: CategoriaFechaEspecial;
  mes?: number;
}

export interface AgendaToolResult {
  success: boolean;
  message: string;
  data?: FechaEspecial | FechaEspecial[];
}
