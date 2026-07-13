-- Recordatorios automáticos para eventos con telegram_chat_id

ALTER TABLE public.special_dates
    ADD COLUMN IF NOT EXISTS reminder_day_before_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminder_same_day_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_special_dates_reminders
    ON public.special_dates (event_date, telegram_chat_id)
    WHERE telegram_chat_id IS NOT NULL;
