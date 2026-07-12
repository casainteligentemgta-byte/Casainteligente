const STORAGE_KEY = 'ci_agenda_session_id';

export function getOrCreateAgendaSessionId(): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
