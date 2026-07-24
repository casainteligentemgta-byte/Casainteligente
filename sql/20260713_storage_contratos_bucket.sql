-- ══════════════════════════════════════════════════════════════
-- STORAGE: bucket contratos
-- Propósito: Almacenar PDFs de contratos generados por la API.
-- Ejecutar en Supabase SQL Editor o como migración.
-- ══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública de PDFs (bucket público)
CREATE POLICY IF NOT EXISTS "contratos_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'contratos');

-- Solo service role / backend sube archivos (sin policy INSERT para anon/authenticated)
-- La API usa SUPABASE_SERVICE_ROLE_KEY, que bypass RLS en Storage.
