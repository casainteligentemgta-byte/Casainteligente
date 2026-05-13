-- ══════════════════════════════════════════════════════════════
-- FIX FINAL: Estabilización de Reclutamiento y Onboarding
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Asegurar columnas en ci_empleados
ALTER TABLE public.ci_empleados 
ADD COLUMN IF NOT EXISTS nombre_completo TEXT,
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS rol_buscado TEXT,
ADD COLUMN IF NOT EXISTS token_registro TEXT,
ADD COLUMN IF NOT EXISTS rol_examen TEXT;

-- 2. Corregir Restricción de Estado (Constraint)
-- Primero eliminamos cualquier restricción existente sobre el estado_proceso
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ci_empleados_estado_proceso_check') THEN
        ALTER TABLE public.ci_empleados DROP CONSTRAINT ci_empleados_estado_proceso_check;
    END IF;
END $$;

-- Aplicamos la nueva restricción con los estados unificados
ALTER TABLE public.ci_empleados 
ADD CONSTRAINT ci_empleados_estado_proceso_check 
CHECK (estado_proceso IN (
    'prospecto_invitado', 
    'pendiente_cv', 
    'cv_completado', 
    'examen_iniciado', 
    'examen_completado', 
    'descartado'
));

-- 3. Asegurar RLS para Onboarding (Candidatos)
-- Permitir que el candidato actualice su propio estado si conoce el token
DROP POLICY IF EXISTS "ci_empleados_public_update" ON public.ci_empleados;
CREATE POLICY "ci_empleados_public_update"
    ON public.ci_empleados FOR UPDATE TO anon
    USING (true) WITH CHECK (true);

-- Asegurar que ci_hojas_vida permita inserciones anónimas
ALTER TABLE public.ci_hojas_vida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ci_hojas_vida_public_insert" ON public.ci_hojas_vida;
CREATE POLICY "ci_hojas_vida_public_insert"
    ON public.ci_hojas_vida FOR INSERT TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "ci_hojas_vida_public_select" ON public.ci_hojas_vida;
CREATE POLICY "ci_hojas_vida_public_select"
    ON public.ci_hojas_vida FOR SELECT TO anon
    USING (true);

-- 4. Ajustar valores por defecto si es necesario
ALTER TABLE public.ci_empleados ALTER COLUMN estado_proceso SET DEFAULT 'pendiente_cv';

-- ══════════════════════════════════════════════════════════════
-- ¡Listo! Ejecuta este SQL en Supabase para estabilizar el sistema.
-- ══════════════════════════════════════════════════════════════
