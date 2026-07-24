-- ══════════════════════════════════════════════════════════════
-- TABLA: telegram_agenda_sessions
-- Historial de conversación del bot de Telegram (memoria entre mensajes).
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.telegram_agenda_sessions (
    telegram_chat_id  TEXT PRIMARY KEY,
    messages          JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider          TEXT,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_agenda_sessions_updated
    ON public.telegram_agenda_sessions (updated_at DESC);

-- Sin RLS: solo se accede con service role desde el servidor.
