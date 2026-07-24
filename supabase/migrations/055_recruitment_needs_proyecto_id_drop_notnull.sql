-- Copia única si 054 no aplicó o quieres forzar sin bloque DO (mismo proyecto Supabase que la app).
-- Requiere que exista la columna proyecto_id (p. ej. migración 034 o 052).

alter table public.recruitment_needs alter column proyecto_id drop not null;

notify pgrst, 'reload schema';
