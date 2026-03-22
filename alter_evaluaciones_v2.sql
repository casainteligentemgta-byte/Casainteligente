-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN v2: Módulo de Evaluación de Élite
-- Agrega campos para Eje Y (Integridad), Eje Z (GMA),
-- cross-check TAG y descalificación por comportamiento.
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.evaluaciones
    ADD COLUMN IF NOT EXISTS gma_score          INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS integrity_score    FLOAT   DEFAULT 0,
    ADD COLUMN IF NOT EXISTS logic_tag          TEXT,
    ADD COLUMN IF NOT EXISTS disqualified       BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS disqualification_reason TEXT;

-- Índice para filtrar descalificados
CREATE INDEX IF NOT EXISTS idx_evaluaciones_disqualified
    ON public.evaluaciones(disqualified);
