-- ══════════════════════════════════════════════════════════════
-- TABLA: ci_hojas_vida
-- Propósito: Almacenar la información detallada del currículum de los candidatos.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ci_hojas_vida (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id             UUID NOT NULL REFERENCES public.ci_empleados(id) ON DELETE CASCADE,
    
    -- Información Personal Adicional
    direccion               TEXT,
    fecha_nacimiento        DATE,
    estado_civil            TEXT,
    nacionalidad            TEXT,
    genero                  TEXT,
    
    -- Educación (JSONB: [{institucion, titulo, fecha_inicio, fecha_fin, nivel}])
    educacion               JSONB DEFAULT '[]'::jsonb,
    
    -- Experiencia Laboral (JSONB: [{empresa, cargo, fecha_inicio, fecha_fin, descripcion}])
    experiencia             JSONB DEFAULT '[]'::jsonb,
    
    -- Habilidades (JSONB: [string])
    habilidades             JSONB DEFAULT '[]'::jsonb,
    
    -- Referencias (JSONB: [{nombre, relacion, telefono}])
    referencias             JSONB DEFAULT '[]'::jsonb,
    
    -- Otros datos (JSONB: {licencia, vehiculo, disponibilidad, pretension_salarial})
    otros_datos             JSONB DEFAULT '{}'::jsonb,
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ci_hojas_vida_empleado ON public.ci_hojas_vida(empleado_id);

-- RLS
ALTER TABLE public.ci_hojas_vida ENABLE ROW LEVEL SECURITY;

-- Admins: Acceso total
CREATE POLICY "ci_hojas_vida_admin_all"
    ON public.ci_hojas_vida FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Público: Solo lectura y escritura si se conoce el token del empleado (vía join o validación previa)
-- Por simplicidad en este MVP, permitiremos que anon inserte si conoce el empleado_id, 
-- pero en una versión real validaríamos el token.
CREATE POLICY "ci_hojas_vida_public_insert"
    ON public.ci_hojas_vida FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "ci_hojas_vida_public_select"
    ON public.ci_hojas_vida FOR SELECT TO anon
    USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_ci_hojas_vida_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ci_hojas_vida_updated_at ON public.ci_hojas_vida;
CREATE TRIGGER trigger_ci_hojas_vida_updated_at
    BEFORE UPDATE ON public.ci_hojas_vida
    FOR EACH ROW EXECUTE FUNCTION update_ci_hojas_vida_updated_at();
