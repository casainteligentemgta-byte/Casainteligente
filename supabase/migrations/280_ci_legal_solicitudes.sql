-- Solicitudes de acceso al módulo abogado (producto Legal standalone).
-- Landing pública /abogado → solicitud → dueño CI aprueba e invita.

create table if not exists public.ci_legal_solicitudes (
  id uuid primary key default gen_random_uuid(),
  nombre_despacho text not null,
  contacto_nombre text not null,
  email text not null,
  telefono text,
  plan_solicitado text not null default 'trial'
    check (plan_solicitado in ('trial', 'solo', 'equipo', 'estudio')),
  mensaje text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  org_id uuid references public.ci_legal_orgs (id) on delete set null,
  revisado_por uuid,
  revisado_at timestamptz,
  notas_internas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_legal_solicitudes_estado
  on public.ci_legal_solicitudes (estado, created_at desc);

create index if not exists idx_ci_legal_solicitudes_email
  on public.ci_legal_solicitudes (lower(email));

comment on table public.ci_legal_solicitudes is
  'Leads / solicitudes self-serve del producto Módulo Abogado (terceros).';

alter table public.ci_legal_solicitudes enable row level security;

drop policy if exists ci_legal_solicitudes_select_auth on public.ci_legal_solicitudes;
create policy ci_legal_solicitudes_select_auth
  on public.ci_legal_solicitudes for select to authenticated
  using (true);

notify pgrst, 'reload schema';
