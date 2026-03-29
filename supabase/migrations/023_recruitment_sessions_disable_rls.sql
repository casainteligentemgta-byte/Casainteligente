-- RLS sin políticas bloquea SELECT al rol del pooler (postgres.PROJECT_REF),
-- distinto del owner creado en SQL Editor → Drizzle no encuentra filas = "sesión inválida".
-- Esta tabla solo la usa el backend (Next + DATABASE_URL); no exponerla al cliente.
-- Si prefieres RLS activo, define políticas explícitas para el rol que use Drizzle.

alter table if exists public.recruitment_sessions disable row level security;
