-- Pasivo laboral por trabajador: config de beneficios + historial salarial.
-- Compatible con el flujo calculate_worker_pasivo (Art. 131, 190 y 142 LOTTT).

-- Fecha de ingreso del trabajador (join_date del cálculo de retroactivo lit. f)
alter table public.ci_empleados
  add column if not exists join_date date;

comment on column public.ci_empleados.join_date is
  'Fecha de ingreso para prestaciones / retroactivo Art. 142 lit. f LOTTT.';

-- Configuración de alícuotas por trabajador (utilidades Art. 131, bono Art. 190)
create table if not exists public.ci_labor_benefit_configs (
  worker_id uuid primary key references public.ci_empleados (id) on delete cascade,
  days_utilidades integer not null default 30
    check (days_utilidades >= 0),
  days_bono_vacacional integer not null default 15
    check (days_bono_vacacional >= 0),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ci_labor_benefit_configs is
  'Días de utilidades (Art. 131 LOTTT) y bono vacacional (Art. 190 LOTTT) por trabajador.';

-- Historial salarial (salario base mensual vigente)
create table if not exists public.ci_labor_salary_history (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.ci_empleados (id) on delete cascade,
  base_salary numeric(18, 4) not null check (base_salary >= 0),
  currency text not null default 'VES',
  effective_date date not null default (timezone('utc', now()))::date,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_labor_salary_history_worker_date
  on public.ci_labor_salary_history (worker_id, effective_date desc);

comment on table public.ci_labor_salary_history is
  'Historial de salario base mensual para pasivo laboral / prestaciones.';

alter table public.ci_labor_benefit_configs enable row level security;
alter table public.ci_labor_salary_history enable row level security;

drop policy if exists ci_labor_benefit_configs_select_auth on public.ci_labor_benefit_configs;
create policy ci_labor_benefit_configs_select_auth
  on public.ci_labor_benefit_configs for select to authenticated
  using (true);

drop policy if exists ci_labor_salary_history_select_auth on public.ci_labor_salary_history;
create policy ci_labor_salary_history_select_auth
  on public.ci_labor_salary_history for select to authenticated
  using (true);

-- Vistas de compatibilidad con el snippet conceptual (workers / benefit_configs / salary_history)
create or replace view public.workers as
select
  e.id,
  e.nombre_completo as full_name,
  coalesce(e.join_date, e.created_at::date) as join_date,
  e.documento,
  e.estado,
  e.created_at
from public.ci_empleados e;

create or replace view public.benefit_configs as
select
  c.worker_id,
  c.days_utilidades,
  c.days_bono_vacacional,
  c.notas,
  c.created_at,
  c.updated_at
from public.ci_labor_benefit_configs c;

create or replace view public.salary_history as
select
  s.id,
  s.worker_id,
  s.base_salary,
  s.currency,
  s.effective_date,
  s.source,
  s.created_at
from public.ci_labor_salary_history s;

grant select on public.workers to authenticated, service_role;
grant select on public.benefit_configs to authenticated, service_role;
grant select on public.salary_history to authenticated, service_role;
grant select, insert, update, delete on public.ci_labor_benefit_configs to authenticated, service_role;
grant select, insert, update, delete on public.ci_labor_salary_history to authenticated, service_role;

notify pgrst, 'reload schema';
