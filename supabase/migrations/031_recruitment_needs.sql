-- Necesidades de puesto: al registrar una, se "activa" el protocolo (enlace ?need= para candidatos).

create table if not exists public.recruitment_needs (
  id uuid primary key default gen_random_uuid() not null,
  title text not null,
  notes text,
  protocol_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_recruitment_needs_created_at on public.recruitment_needs (created_at desc);

comment on table public.recruitment_needs is
  'Vacante / necesidad de empleo; la entrevista en /reclutamiento puede asociarse vía ?need=id';

alter table public.recruitment_needs enable row level security;
