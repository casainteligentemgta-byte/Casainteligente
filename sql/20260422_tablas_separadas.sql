-- 1. Tabla de Prospectos (Fase de Reclutamiento)
CREATE TABLE IF NOT EXISTS public.ci_prospectos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres                 TEXT NOT NULL,
    celular                 TEXT NOT NULL,
    cargo                   TEXT NOT NULL,
    token                   TEXT UNIQUE NOT NULL,
    estado                  TEXT NOT NULL DEFAULT 'invitado' 
                            CHECK (estado IN ('invitado', 'en_evaluacion', 'completado', 'descartado')),
    recordatorio_enviado    BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_invitacion        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Evaluaciones (Resultados de Tests)
CREATE TABLE IF NOT EXISTS public.ci_evaluaciones (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospecto_id            UUID REFERENCES public.ci_prospectos(id) ON DELETE CASCADE,
    puntaje                 INTEGER DEFAULT 0,
    respuestas              JSONB DEFAULT '{}'::jsonb,
    comentarios_ai          TEXT,
    fecha_completado        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Empleados (Personal Contratado)
-- Nota: Si ya existe ci_empleados, la limpiaremos o crearemos una nueva estructura.
CREATE TABLE IF NOT EXISTS public.ci_empleados_activos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospecto_id            UUID REFERENCES public.ci_prospectos(id), -- Referencia opcional al origen
    nombres                 TEXT NOT NULL,
    celular                 TEXT NOT NULL,
    cargo                   TEXT NOT NULL,
    fecha_ingreso           DATE DEFAULT CURRENT_DATE,
    estado                  TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'vacaciones', 'baja')),
    documentos_url          JSONB DEFAULT '[]'::jsonb, -- Enlaces a IDs, Curriculum, etc.
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prospectos_token ON public.ci_prospectos(token);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_prospecto ON public.ci_evaluaciones(prospecto_id);

-- RLS (Row Level Security)
ALTER TABLE public.ci_prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_empleados_activos ENABLE ROW LEVEL SECURITY;

-- Políticas para Authenticated (Admin)
CREATE POLICY "admin_all_prospectos" ON public.ci_prospectos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_evaluaciones" ON public.ci_evaluaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_empleados" ON public.ci_empleados_activos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas para Anon (Onboarding)
CREATE POLICY "anon_read_prospectos" ON public.ci_prospectos FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_evaluaciones" ON public.ci_evaluaciones FOR INSERT TO anon WITH CHECK (true);
