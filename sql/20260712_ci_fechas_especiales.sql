-- ══════════════════════════════════════════════════════════════
-- TABLA: special_dates
-- Propósito: Cumpleaños, citas, recordatorios y fechas especiales
--            consumidas por las herramientas Gemini (agendaTools).
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.special_dates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL
                CHECK (category IN ('birthday', 'appointment', 'reminder', 'holiday')),
    event_date  DATE NOT NULL,
    event_time  TIME,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_special_dates_user_event_date
    ON public.special_dates (user_id, event_date);

CREATE INDEX IF NOT EXISTS idx_special_dates_category_event_date
    ON public.special_dates (category, event_date);

ALTER TABLE public.special_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "special_dates_select_own"
    ON public.special_dates FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "special_dates_insert_own"
    ON public.special_dates FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "special_dates_update_own"
    ON public.special_dates FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "special_dates_delete_own"
    ON public.special_dates FOR DELETE TO authenticated
    USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_special_dates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_special_dates_updated_at ON public.special_dates;
CREATE TRIGGER trigger_special_dates_updated_at
    BEFORE UPDATE ON public.special_dates
    FOR EACH ROW EXECUTE FUNCTION update_special_dates_updated_at();
