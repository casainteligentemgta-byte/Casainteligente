-- Configuración de costo hora por cargo (IVSS, FAOV, INCES, prestaciones vía factor; cestaticket).
-- costo_hora_total = ((salario_base_mensual * factor_prestacional) + cestaticket_mensual) / 173.33

create table if not exists public.ci_config_nomina (
  id uuid primary key default gen_random_uuid(),
  cargo_nombre text not null,
  cargo_codigo text,
  salario_base_mensual numeric(14, 2) not null check (salario_base_mensual >= 0),
  factor_prestacional numeric(10, 4) not null default 1.6 check (factor_prestacional > 0),
  cestaticket_mensual numeric(14, 2) not null default 0 check (cestaticket_mensual >= 0),
  costo_hora_total numeric(16, 6) generated always as (
    round(
      ((salario_base_mensual * factor_prestacional) + cestaticket_mensual) / 173.33,
      6
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ci_config_nomina_cargo_nombre_lower
  on public.ci_config_nomina (lower(trim(cargo_nombre)));

create index if not exists idx_ci_config_nomina_cargo_codigo
  on public.ci_config_nomina (cargo_codigo)
  where cargo_codigo is not null;

comment on table public.ci_config_nomina is
  'Tabulador interno: costo hora total (VES) con carga prestacional y cestaticket sobre 173.33 h/mes legal.';
comment on column public.ci_config_nomina.factor_prestacional is
  'Multiplicador salarial (ej. 1.6 ≈ 60% carga IVSS/FAOV/INCES/prestaciones agregada).';
comment on column public.ci_config_nomina.costo_hora_total is
  'Generado: ((salario_base_mensual * factor_prestacional) + cestaticket_mensual) / 173.33.';

create or replace function public.actualizar_updated_at_ci_config_nomina()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_ci_config_nomina_updated on public.ci_config_nomina;
create trigger tr_ci_config_nomina_updated
  before update on public.ci_config_nomina
  for each row execute function public.actualizar_updated_at_ci_config_nomina();

alter table public.ci_config_nomina enable row level security;

drop policy if exists "ci_config_nomina_select_anon" on public.ci_config_nomina;
drop policy if exists "ci_config_nomina_insert_anon" on public.ci_config_nomina;
drop policy if exists "ci_config_nomina_update_anon" on public.ci_config_nomina;
drop policy if exists "ci_config_nomina_delete_anon" on public.ci_config_nomina;
drop policy if exists "ci_config_nomina_select_auth" on public.ci_config_nomina;
drop policy if exists "ci_config_nomina_insert_auth" on public.ci_config_nomina;
drop policy if exists "ci_config_nomina_update_auth" on public.ci_config_nomina;
drop policy if exists "ci_config_nomina_delete_auth" on public.ci_config_nomina;

create policy "ci_config_nomina_select_anon" on public.ci_config_nomina for select to anon using (true);
create policy "ci_config_nomina_insert_anon" on public.ci_config_nomina for insert to anon with check (true);
create policy "ci_config_nomina_update_anon" on public.ci_config_nomina for update to anon using (true) with check (true);
create policy "ci_config_nomina_delete_anon" on public.ci_config_nomina for delete to anon using (true);
create policy "ci_config_nomina_select_auth" on public.ci_config_nomina for select to authenticated using (true);
create policy "ci_config_nomina_insert_auth" on public.ci_config_nomina for insert to authenticated with check (true);
create policy "ci_config_nomina_update_auth" on public.ci_config_nomina for update to authenticated using (true) with check (true);
create policy "ci_config_nomina_delete_auth" on public.ci_config_nomina for delete to authenticated using (true);

grant select, insert, update, delete on public.ci_config_nomina to anon, authenticated, service_role;

insert into public.ci_config_nomina (cargo_nombre, cargo_codigo, salario_base_mensual, factor_prestacional, cestaticket_mensual)
select 'Maestro de Obra', 'MO', 520.00, 1.60, 95.00
where not exists (select 1 from public.ci_config_nomina c where lower(trim(c.cargo_nombre)) = lower(trim('Maestro de Obra')));
insert into public.ci_config_nomina (cargo_nombre, cargo_codigo, salario_base_mensual, factor_prestacional, cestaticket_mensual)
select 'Albañil', 'ALB', 380.00, 1.60, 95.00
where not exists (select 1 from public.ci_config_nomina c where lower(trim(c.cargo_nombre)) = lower(trim('Albañil')));
insert into public.ci_config_nomina (cargo_nombre, cargo_codigo, salario_base_mensual, factor_prestacional, cestaticket_mensual)
select 'Ayudante', 'AYU', 280.00, 1.60, 95.00
where not exists (select 1 from public.ci_config_nomina c where lower(trim(c.cargo_nombre)) = lower(trim('Ayudante')));

notify pgrst, 'reload schema';
