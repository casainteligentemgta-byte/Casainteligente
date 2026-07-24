-- Umbrales de alertas de despacho a obra por proyecto (exceso presupuestario / saldo).

create table if not exists public.inv_despacho_alertas_proyecto (
  ci_proyecto_id uuid primary key references public.ci_proyectos (id) on delete cascade,
  exceso_advertencia_pct numeric(8, 2) not null default 5,
  exceso_critico_pct numeric(8, 2) not null default 15,
  saldo_informativo_pct numeric(8, 2) not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_despacho_alertas_pct_positive check (
    exceso_advertencia_pct > 0
    and exceso_critico_pct > 0
    and saldo_informativo_pct >= 0
  ),
  constraint inv_despacho_alertas_critico_ge_adv check (
    exceso_critico_pct >= exceso_advertencia_pct
  )
);

comment on table public.inv_despacho_alertas_proyecto is
  'Umbrales configurables de alertas al despachar material a partidas (por obra).';

create or replace function public.inv_despacho_alertas_set_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_inv_despacho_alertas_updated on public.inv_despacho_alertas_proyecto;
create trigger tr_inv_despacho_alertas_updated
  before update on public.inv_despacho_alertas_proyecto
  for each row execute function public.inv_despacho_alertas_set_updated();

alter table public.inv_despacho_alertas_proyecto enable row level security;

drop policy if exists "inv_despacho_alertas_proyecto_select_anon" on public.inv_despacho_alertas_proyecto;
drop policy if exists "inv_despacho_alertas_proyecto_insert_anon" on public.inv_despacho_alertas_proyecto;
drop policy if exists "inv_despacho_alertas_proyecto_update_anon" on public.inv_despacho_alertas_proyecto;
drop policy if exists "inv_despacho_alertas_proyecto_delete_anon" on public.inv_despacho_alertas_proyecto;

create policy "inv_despacho_alertas_proyecto_select_anon"
  on public.inv_despacho_alertas_proyecto for select to anon using (true);
create policy "inv_despacho_alertas_proyecto_insert_anon"
  on public.inv_despacho_alertas_proyecto for insert to anon with check (true);
create policy "inv_despacho_alertas_proyecto_update_anon"
  on public.inv_despacho_alertas_proyecto for update to anon using (true) with check (true);
create policy "inv_despacho_alertas_proyecto_delete_anon"
  on public.inv_despacho_alertas_proyecto for delete to anon using (true);

notify pgrst, 'reload schema';
