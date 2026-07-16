-- Refuerzo: recarga del caché de PostgREST (si tras 044 aún ves "schema cache" para ci_obras u otras tablas).
-- Ejecutar en el MISMO proyecto Supabase que usa NEXT_PUBLIC_SUPABASE_URL.
-- Si no basta: Dashboard → Settings → General → Pause project → Resume (reinicia servicios).

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
