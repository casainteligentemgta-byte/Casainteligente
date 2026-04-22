-- Agregar columna image_url a la tabla products
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Opcional: refrescar el schema cache de PostgREST
-- (Supabase lo hace automáticamente, pero si el error persiste ejecutar esto)
NOTIFY pgrst, 'reload schema';
