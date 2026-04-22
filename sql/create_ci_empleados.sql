-- ══════════════════════════════════════════════════════════════
-- TABLA: ci_empleados (Prospectos / Candidatos)
-- Propósito: Gestión de invitaciones y recordatorios de onboarding.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ci_empleados (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres                 TEXT NOT NULL,
    celular                 TEXT NOT NULL,
    cargo                   TEXT NOT NULL,
    token                   TEXT UNIQUE NOT NULL,
    
    -- Estado del proceso de reclutamiento
    estado_proceso          TEXT NOT NULL DEFAULT 'prospecto_invitado'
                            CHECK (estado_proceso IN ('prospecto_invitado', 'en_evaluacion', 'completado', 'descartado')),
    
    -- Control de recordatorios WhatsApp
    recordatorio_enviado    BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_invitacion        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimización de Edge Functions y búsquedas
CREATE INDEX IF NOT EXISTS idx_ci_empleados_token           ON public.ci_empleados(token);
CREATE INDEX IF NOT EXISTS idx_ci_empleados_estado          ON public.ci_empleados(estado_proceso);
CREATE INDEX IF NOT EXISTS idx_ci_empleados_recordatorio    ON public.ci_empleados(recordatorio_enviado, fecha_invitacion);

-- RLS
ALTER TABLE public.ci_empleados ENABLE ROW LEVEL SECURITY;

-- Admins: Acceso total
CREATE POLICY "ci_empleados_admin_all"
    ON public.ci_empleados FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Público: Solo lectura mediante token para el proceso de onboarding
CREATE POLICY "ci_empleados_public_read"
    ON public.ci_empleados FOR SELECT TO anon
    USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_ci_empleados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ci_empleados_updated_at ON public.ci_empleados;
CREATE TRIGGER trigger_ci_empleados_updated_at
    BEFORE UPDATE ON public.ci_empleados
    FOR EACH ROW EXECUTE FUNCTION update_ci_empleados_updated_at();
