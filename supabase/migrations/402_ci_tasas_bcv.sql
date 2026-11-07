-- Histórico diario de la tasa oficial BCV (bolívares por 1 USD).
-- Lo escribe el cron /api/cron/bcv-tasa (service_role). Lectura autenticada.
-- Idempotente.

create table if not exists public.ci_tasas_bcv (
  fecha date primary key,
  usd numeric not null check (usd > 0),
  fuente text not null,
  fecha_valor date,
  created_at timestamptz not null default now()
);

comment on table public.ci_tasas_bcv is
  'Tasa oficial BCV USD (Bs por 1 USD) por fecha de aplicación. fuente = bcv.org.ve u origen de respaldo.';
comment on column public.ci_tasas_bcv.fecha is
  'Día al que aplica la tasa (normalmente igual a fecha_valor).';
comment on column public.ci_tasas_bcv.usd is
  'Bolívares por 1 USD.';
comment on column public.ci_tasas_bcv.fuente is
  'Origen: bcv.org.ve (oficial) o agregador de respaldo (bcv.today / bcv.rafnixg).';
comment on column public.ci_tasas_bcv.fecha_valor is
  'Fecha Valor publicada por el BCV, si se conoce.';

alter table public.ci_tasas_bcv enable row level security;

revoke all on table public.ci_tasas_bcv from anon;
revoke all on table public.ci_tasas_bcv from public;
grant select on table public.ci_tasas_bcv to authenticated;
revoke insert, update, delete, truncate on table public.ci_tasas_bcv from authenticated, anon;

drop policy if exists ci_tasas_bcv_select_auth on public.ci_tasas_bcv;
create policy ci_tasas_bcv_select_auth on public.ci_tasas_bcv
  for select to authenticated
  using (true);

notify pgrst, 'reload schema';
