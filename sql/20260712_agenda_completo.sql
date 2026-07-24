-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN ÚNICA: Módulo Agenda Casa Inteligente
-- Ejecutar en Supabase SQL Editor (una sola vez).
--
-- Incluye:
--   1. special_dates          — eventos (web + Telegram)
--   2. telegram_agenda_sessions — memoria del chat Telegram
--   3. Recordatorios automáticos por Telegram
--
-- Idempotente: se puede re-ejecutar sin romper objetos existentes.
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. TABLA: special_dates
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.special_dates (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id            TEXT,
    title                       TEXT NOT NULL,
    category                    TEXT NOT NULL
                                CHECK (category IN ('birthday', 'appointment', 'reminder', 'holiday')),
    event_date                  DATE NOT NULL,
    event_time                  TIME,
    notes                       TEXT,
    reminder_day_before_sent_at TIMESTAMPTZ,
    reminder_same_day_sent_at   TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columnas nuevas si la tabla ya existía con esquema anterior
ALTER TABLE public.special_dates
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
    ADD COLUMN IF NOT EXISTS reminder_day_before_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminder_same_day_sent_at TIMESTAMPTZ;

ALTER TABLE public.special_dates
    ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'special_dates_owner_check'
    ) THEN
        ALTER TABLE public.special_dates
            ADD CONSTRAINT special_dates_owner_check
            CHECK (user_id IS NOT NULL OR telegram_chat_id IS NOT NULL);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_special_dates_user_event_date
    ON public.special_dates (user_id, event_date)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_special_dates_telegram_event_date
    ON public.special_dates (telegram_chat_id, event_date)
    WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_special_dates_category_event_date
    ON public.special_dates (category, event_date);

CREATE INDEX IF NOT EXISTS idx_special_dates_reminders
    ON public.special_dates (event_date, telegram_chat_id)
    WHERE telegram_chat_id IS NOT NULL;

ALTER TABLE public.special_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "special_dates_select_own" ON public.special_dates;
CREATE POLICY "special_dates_select_own"
    ON public.special_dates FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "special_dates_insert_own" ON public.special_dates;
CREATE POLICY "special_dates_insert_own"
    ON public.special_dates FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "special_dates_update_own" ON public.special_dates;
CREATE POLICY "special_dates_update_own"
    ON public.special_dates FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "special_dates_delete_own" ON public.special_dates;
CREATE POLICY "special_dates_delete_own"
    ON public.special_dates FOR DELETE TO authenticated
    USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_special_dates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_special_dates_updated_at ON public.special_dates;
CREATE TRIGGER trigger_special_dates_updated_at
    BEFORE UPDATE ON public.special_dates
    FOR EACH ROW EXECUTE FUNCTION public.update_special_dates_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 2. TABLA: telegram_agenda_sessions (memoria del bot)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.telegram_agenda_sessions (
    telegram_chat_id  TEXT PRIMARY KEY,
    messages          JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider          TEXT,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_agenda_sessions_updated
    ON public.telegram_agenda_sessions (updated_at DESC);

-- Sin RLS: solo el servidor (service role) lee/escribe esta tabla.

COMMIT;

-- ══════════════════════════════════════════════════════════════
-- Verificación rápida (opcional — descomenta para ejecutar)
-- ══════════════════════════════════════════════════════════════
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('special_dates', 'telegram_agenda_sessions');
