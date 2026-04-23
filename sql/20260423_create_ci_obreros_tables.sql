-- ══════════════════════════════════════════════════════════════
-- TABLAS: Obreros, Tabulador Salarial y Cuadrillas
-- Propósito: Gestión de personal operativo (obreros), sus escalas salariales según gaceta oficial y asignación a cuadrillas/tareas.
-- ══════════════════════════════════════════════════════════════

-- 1. TABLA: ci_tabulador_salarial
CREATE TABLE IF NOT EXISTS public.ci_tabulador_salarial (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cargo_nombre            TEXT NOT NULL UNIQUE,
    salario_diario          NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    salario_semanal         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    referencia_gaceta       TEXT,
    gaceta_pdf_url          TEXT,
    fecha_vigencia          DATE NOT NULL,
    activo                  BOOLEAN DEFAULT true,
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para ci_tabulador_salarial
ALTER TABLE public.ci_tabulador_salarial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tabulador_admin_all"
    ON public.ci_tabulador_salarial FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Trigger updated_at para ci_tabulador_salarial
CREATE OR REPLACE FUNCTION update_ci_tabulador_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ci_tabulador_updated_at ON public.ci_tabulador_salarial;
CREATE TRIGGER trigger_ci_tabulador_updated_at
    BEFORE UPDATE ON public.ci_tabulador_salarial
    FOR EACH ROW EXECUTE FUNCTION update_ci_tabulador_updated_at();

-- 2. TABLA: ci_cuadrillas
CREATE TABLE IF NOT EXISTS public.ci_cuadrillas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_tarea            TEXT NOT NULL,
    ubicacion               TEXT,
    estado                  TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'completada', 'pausada')),
    lider_id                UUID REFERENCES public.ci_empleados(id) ON DELETE SET NULL,
    fecha_inicio            DATE,
    fecha_fin_estimada      DATE,
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para ci_cuadrillas
ALTER TABLE public.ci_cuadrillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuadrillas_admin_all"
    ON public.ci_cuadrillas FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Trigger updated_at para ci_cuadrillas
CREATE OR REPLACE FUNCTION update_ci_cuadrillas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ci_cuadrillas_updated_at ON public.ci_cuadrillas;
CREATE TRIGGER trigger_ci_cuadrillas_updated_at
    BEFORE UPDATE ON public.ci_cuadrillas
    FOR EACH ROW EXECUTE FUNCTION update_ci_cuadrillas_updated_at();

-- 3. TABLA: ci_cuadrilla_miembros
CREATE TABLE IF NOT EXISTS public.ci_cuadrilla_miembros (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuadrilla_id            UUID NOT NULL REFERENCES public.ci_cuadrillas(id) ON DELETE CASCADE,
    empleado_id             UUID NOT NULL REFERENCES public.ci_empleados(id) ON DELETE CASCADE,
    fecha_asignacion        DATE DEFAULT CURRENT_DATE,
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cuadrilla_id, empleado_id)
);

-- RLS para ci_cuadrilla_miembros
ALTER TABLE public.ci_cuadrilla_miembros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuadrilla_miembros_admin_all"
    ON public.ci_cuadrilla_miembros FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Crear Storage Bucket para las Gacetas si no existe
-- Nota: Esto asume que el bucket "documentos_rrhh" ya podría existir, pero lo intentamos crear para estar seguros.
-- Si usamos el Dashboard de Supabase es más fácil crearlo a mano, pero dejo la referencia aquí.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos_rrhh', 'documentos_rrhh', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage (Público puede leer, Auth puede subir)
CREATE POLICY "Public Access to Gacetas" ON storage.objects FOR SELECT USING (bucket_id = 'documentos_rrhh');
CREATE POLICY "Auth Users can upload Gacetas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos_rrhh');
CREATE POLICY "Auth Users can update Gacetas" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos_rrhh');
CREATE POLICY "Auth Users can delete Gacetas" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos_rrhh');
