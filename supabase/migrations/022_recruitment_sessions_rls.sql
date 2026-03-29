-- RLS: la tabla no debe exponerse por PostgREST a anon sin políticas.
-- El backend (Drizzle con rol postgres / service) sigue pudiendo escribir.

alter table if exists public.recruitment_sessions enable row level security;
