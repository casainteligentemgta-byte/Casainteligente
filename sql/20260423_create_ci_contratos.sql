-- ══════════════════════════════════════════════════════════════
-- TABLA: ci_contratos
-- Propósito: Almacenar los contratos generados para los empleados/obreros.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ci_contratos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id             UUID NOT NULL REFERENCES public.ci_empleados(id) ON DELETE CASCADE,
    
    cargo_acordado          TEXT NOT NULL,
    salario_base            NUMERIC(10, 2) NOT NULL,
    bonificaciones          NUMERIC(10, 2) DEFAULT 0,
    fecha_ingreso           DATE NOT NULL,
    
    estado                  TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'suspendido')),
    pdf_url                 TEXT, -- Opcional, para guardar enlace al PDF generado
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ci_contratos_empleado ON public.ci_contratos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_ci_contratos_estado ON public.ci_contratos(estado);

-- RLS
ALTER TABLE public.ci_contratos ENABLE ROW LEVEL SECURITY;

-- Admins: Acceso total
CREATE POLICY "ci_contratos_admin_all"
    ON public.ci_contratos FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_ci_contratos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ci_contratos_updated_at ON public.ci_contratos;
CREATE TRIGGER trigger_ci_contratos_updated_at
    BEFORE UPDATE ON public.ci_contratos
    FOR EACH ROW EXECUTE FUNCTION update_ci_contratos_updated_at();
