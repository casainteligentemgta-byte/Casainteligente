-- Asegura public.empresas en Preview/bases donde 004/008 no se reaplican
-- (branching con historial del padre ya marcado como applied).

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
