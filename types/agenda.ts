export type CategoriaFechaEspecial = 'birthday' | 'appointment' | 'reminder' | 'holiday';

export type LlmProvider = 'gemini' | 'openai';

export interface SpecialDate {
  id: string;
  user_id: string | null;
  telegram_chat_id: string | null;
  title: string;
  category: CategoriaFechaEspecial;
  event_date: string;
  event_time: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AgendaOwner {
  userId?: string;
  telegramChatId?: string;
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
  | { status: 'success'; data: SpecialDate[] }
  | { status: 'error'; message: string };

export type AgendaChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type AgendaChatResponse = {
  reply: string;
  toolCalls: Array<{ name: string; result: unknown }>;
  provider: LlmProvider;
  model: string;
};

export const CATEGORIA_LABELS: Record<CategoriaFechaEspecial, string> = {
  birthday: 'Cumpleaños',
  appointment: 'Cita',
  reminder: 'Recordatorio',
  holiday: 'Feriado',
};
