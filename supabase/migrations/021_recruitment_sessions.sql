-- Tabla de sesiones del módulo Reclutamiento (Drizzle: recruitment_sessions)
-- Ejecutar en Supabase → SQL Editor si prefieres no usar `npm run db:push`

create table if not exists public.recruitment_sessions (
  id uuid primary key default gen_random_uuid() not null,
  state jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_recruitment_sessions_expires_at
  on public.recruitment_sessions (expires_at);
