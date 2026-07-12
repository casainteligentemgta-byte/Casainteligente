export type CategoriaFechaEspecial = 'birthday' | 'appointment' | 'reminder' | 'holiday';

export interface SpecialDate {
  id: string;
  user_id: string;
  title: string;
  category: CategoriaFechaEspecial;
  event_date: string;
  event_time: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AgendaToolArgs {
  titulo?: string;
  categoria?: CategoriaFechaEspecial;
  fecha?: string;
  hora?: string;
  notas?: string;
  notes?: string;
  mes?: number | string;
}

export type AgendaToolResult =
  | { status: 'success'; message: string }
  | { status: 'success'; data: SpecialDate[] };
