-- ══════════════════════════════════════════════════════════════
-- FIX: Relax constraints on ci_empleados
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Relax constraints to allow prospect creation without all data
ALTER TABLE public.ci_empleados ALTER COLUMN nombre_completo DROP NOT NULL;
ALTER TABLE public.ci_empleados ALTER COLUMN rol_examen DROP NOT NULL;

-- Ensure essential columns for the recruitment flow are present and required
-- If these columns don't exist, the ADD COLUMN part in fix_ci_empleados_columns.sql should have run.
-- Here we just ensure they are NOT NULL.

DO $$ 
BEGIN
    -- Check if columns exist before altering
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ci_empleados' AND column_name = 'nombres') THEN
        ALTER TABLE public.ci_empleados ALTER COLUMN nombres SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ci_empleados' AND column_name = 'celular') THEN
        ALTER TABLE public.ci_empleados ALTER COLUMN celular SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ci_empleados' AND column_name = 'cargo') THEN
        ALTER TABLE public.ci_empleados ALTER COLUMN cargo SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ci_empleados' AND column_name = 'token') THEN
        ALTER TABLE public.ci_empleados ALTER COLUMN token SET NOT NULL;
    END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- ¡Listo! Ejecuta este SQL en Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════
