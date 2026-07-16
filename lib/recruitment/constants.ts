/** TTL de sesión en ms (15 minutos). */
export const RECRUITMENT_SESSION_TTL_MS = 15 * 60 * 1000;

export const RECRUITMENT_OPENING_LINE =
  'Hola. Soy el asistente de esta fase. Cuéntame en pocas frases tu experiencia reciente liderando o cerrando tareas bajo presión.';

/** Máximo de confrontaciones por bloque antes de forzar cierre o solo avisar (según política). */
export const MAX_CONFRONTATIONS_PER_BLOCK = 2;

/** Turnos por bloque antes de avanzar de bloque (demo). */
export const TURNS_PER_BLOCK = 5;

export const TOTAL_BLOCKS = 3;

/** Eventos de fraude: avisos antes de cierre (escalado). */
export const FRAUD_WARN_THRESHOLD = 4;
export const FRAUD_CLOSE_THRESHOLD = 8;

/** Modelo Gemini (REST). */
export const GEMINI_MODEL = 'gemini-2.0-flash';
