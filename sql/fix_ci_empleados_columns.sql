-- ══════════════════════════════════════════════════════════════
-- FIX: Agregar columnas faltantes a ci_empleados
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Se detectó que la tabla ci_empleados existe pero le faltan columnas críticas
-- para el proceso de reclutamiento.

ALTER TABLE public.ci_empleados 
ADD COLUMN IF NOT EXISTS nombres TEXT,
ADD COLUMN IF NOT EXISTS celular TEXT,
ADD COLUMN IF NOT EXISTS cargo TEXT,
ADD COLUMN IF NOT EXISTS token TEXT;

-- Asegurar que las columnas tengan las restricciones correctas
-- (Nota: Si hay datos previos, esto podría fallar si las columnas están vacías.
-- Como la tabla está vacía actualmente, es seguro).

ALTER TABLE public.ci_empleados ALTER COLUMN nombres SET NOT NULL;
ALTER TABLE public.ci_empleados ALTER COLUMN celular SET NOT NULL;
ALTER TABLE public.ci_empleados ALTER COLUMN cargo SET NOT NULL;
ALTER TABLE public.ci_empleados ALTER COLUMN token SET NOT NULL;

-- Agregar restricción UNIQUE al token si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ci_empleados_token_key') THEN
        ALTER TABLE public.ci_empleados ADD CONSTRAINT ci_empleados_token_key UNIQUE (token);
    END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- ¡Listo! Ejecuta este SQL en Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════
