-- NetVision Pro: proyectos por usuario (persistencia en la nube).
-- Diseño completo en JSONB; plano_url opcional (puede omitirse si es muy grande).

create table if not exists public.netvision_projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null default 'Proyecto sin nombre',
  description text not null default '',
  client_name text not null default '',
  unit_system text not null default 'metric'
    check (unit_system in ('metric', 'imperial', 'mixed')),
  currency text not null default 'USD'
    check (currency in ('USD', 'VES', 'EUR')),
  distributor_margin_pct numeric(6, 2) not null default 15
    check (distributor_margin_pct >= 0 and distributor_margin_pct <= 100),
  compliance_profile_id text not null default 'VE',
  retention_days integer not null default 30
    check (retention_days >= 1 and retention_days <= 3650),
  plano_nombre text not null default '',
  has_plano boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.netvision_projects is
  'Proyectos NetVision Pro por usuario autenticado (diseño en payload JSONB).';

create index if not exists idx_netvision_projects_user_updated
  on public.netvision_projects (user_id, updated_at desc);

create or replace function public.netvision_projects_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_netvision_projects_updated_at on public.netvision_projects;
create trigger trg_netvision_projects_updated_at
  before update on public.netvision_projects
  for each row
  execute function public.netvision_projects_set_updated_at();

alter table public.netvision_projects enable row level security;

drop policy if exists netvision_projects_select on public.netvision_projects;
create policy netvision_projects_select
  on public.netvision_projects
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists netvision_projects_insert on public.netvision_projects;
create policy netvision_projects_insert
  on public.netvision_projects
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists netvision_projects_update on public.netvision_projects;
create policy netvision_projects_update
  on public.netvision_projects
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists netvision_projects_delete on public.netvision_projects;
create policy netvision_projects_delete
  on public.netvision_projects
  for delete
  to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
