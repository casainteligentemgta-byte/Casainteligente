-- Tablas base que a veces faltan en Preview si el padre ya marcó 004/008/031
-- como applied con otro contenido histórico. Idempotente.
-- Versión 320: no comparte prefijo con 031 ni 198 (el CLI ordena por
-- nombre de archivo y 0311/1980 hacían parecer que 031/198 faltaban).

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  telefono text,
  email text,
  rif text,
  notas text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

alter table public.empresas add column if not exists rif text;
alter table public.empresas add column if not exists notas text;

create index if not exists idx_empresas_nombre on public.empresas (nombre);

alter table public.empresas enable row level security;

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

notify pgrst, 'reload schema';
