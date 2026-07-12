-- ══════════════════════════════════════════════════════════════
-- TABLA: ci_fechas_especiales
-- Propósito: Cumpleaños, citas, recordatorios y fechas especiales
--            consumidas por las herramientas Gemini (agendaTools).
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ci_fechas_especiales (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo      TEXT NOT NULL,
    categoria   TEXT NOT NULL
                CHECK (categoria IN ('birthday', 'appointment', 'reminder', 'holiday')),
    fecha       DATE NOT NULL,
    hora        TIME,
    notas       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_fechas_especiales_user_fecha
    ON public.ci_fechas_especiales (user_id, fecha);

CREATE INDEX IF NOT EXISTS idx_ci_fechas_especiales_categoria_fecha
    ON public.ci_fechas_especiales (categoria, fecha);

ALTER TABLE public.ci_fechas_especiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_fechas_especiales_select_own"
    ON public.ci_fechas_especiales FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "ci_fechas_especiales_insert_own"
    ON public.ci_fechas_especiales FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "ci_fechas_especiales_update_own"
    ON public.ci_fechas_especiales FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL)
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "ci_fechas_especiales_delete_own"
    ON public.ci_fechas_especiales FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

CREATE OR REPLACE FUNCTION update_ci_fechas_especiales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ci_fechas_especiales_updated_at ON public.ci_fechas_especiales;
CREATE TRIGGER trigger_ci_fechas_especiales_updated_at
    BEFORE UPDATE ON public.ci_fechas_especiales
    FOR EACH ROW EXECUTE FUNCTION update_ci_fechas_especiales_updated_at();
