-- Asegura recruitment_needs antes de 032_* cuando Preview ya tiene
-- schema_migrations.version=031 aplicada con otro archivo histórico
-- (p. ej. solo ci_preguntas) y se omite 031_recruitment_needs.sql.

create table if not exists public.recruitment_needs (
  id uuid primary key default gen_random_uuid() not null,
  title text not null,
  notes text,
  protocol_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_recruitment_needs_created_at
  on public.recruitment_needs (created_at desc);

alter table public.recruitment_needs enable row level security;

-- Banco de preguntas (contenido que convivía en el antiguo 031_ci_preguntas).
create table if not exists public.ci_preguntas (
  id uuid primary key default gen_random_uuid(),
  tipo_vacante text not null,
  categoria text not null,
  pregunta text not null,
  opciones jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_preguntas_tipo on public.ci_preguntas (tipo_vacante);
create index if not exists idx_ci_preguntas_tipo_cat on public.ci_preguntas (tipo_vacante, categoria);

alter table public.ci_preguntas enable row level security;
