-- Repair: ci_proyecto_fondos en prod sin columnas bimonetarias (migr. 188 no aplicada o tabla parcial).
-- Error típico: column "saldo_usd" of relation "ci_proyecto_fondos" does not exist

create table if not exists public.ci_proyecto_fondos (
  proyecto_id uuid primary key references public.ci_proyectos (id) on delete cascade,
  saldo_usd numeric(18, 2) not null default 0,
  saldo_ves numeric(18, 2) not null default 0,
  total_abonado_usd numeric(18, 2) not null default 0,
  total_abonado_ves numeric(18, 2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ci_proyecto_fondos
  add column if not exists saldo_usd numeric(18, 2) not null default 0,
  add column if not exists saldo_ves numeric(18, 2) not null default 0,
  add column if not exists total_abonado_usd numeric(18, 2) not null default 0,
  add column if not exists total_abonado_ves numeric(18, 2) not null default 0,
  add column if not exists updated_at timestamptz not null default now();

comment on table public.ci_proyecto_fondos is
  'Saldo consolidado de abonos del cliente por proyecto (USD y VES).';

alter table public.ci_proyecto_fondos enable row level security;

drop policy if exists "ci_proyecto_fondos_all_anon" on public.ci_proyecto_fondos;
create policy "ci_proyecto_fondos_all_anon" on public.ci_proyecto_fondos
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.ci_proyecto_fondos to anon, authenticated, service_role;

notify pgrst, 'reload schema';
