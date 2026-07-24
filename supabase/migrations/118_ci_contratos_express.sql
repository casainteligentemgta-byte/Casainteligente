-- Contratos generados sin expediente de empleado (express): auditoría + ruta en Storage.

create table if not exists public.ci_contratos_express (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete restrict,
  config_nomina_id uuid references public.ci_config_nomina (id) on delete set null,
  obrero_nombre text not null,
  obrero_cedula text not null,
  obrero_direccion text,
  bono_manual_ves numeric(14, 2) not null default 0 check (bono_manual_ves >= 0),
  salario_base_mensual_snapshot numeric(14, 2),
  cargo_nombre_snapshot text,
  pdf_storage_path text not null,
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists idx_ci_contratos_express_proyecto on public.ci_contratos_express (proyecto_id);
create index if not exists idx_ci_contratos_express_created on public.ci_contratos_express (created_at desc);

comment on table public.ci_contratos_express is
  'Contrato obrero estructurado generado sin fila en ci_empleados; PDF en bucket contratos_obreros.';

alter table public.ci_contratos_express enable row level security;

drop policy if exists "ci_ctr_express_select_anon" on public.ci_contratos_express;
drop policy if exists "ci_ctr_express_insert_anon" on public.ci_contratos_express;
drop policy if exists "ci_ctr_express_update_anon" on public.ci_contratos_express;
drop policy if exists "ci_ctr_express_delete_anon" on public.ci_contratos_express;
drop policy if exists "ci_ctr_express_select_auth" on public.ci_contratos_express;
drop policy if exists "ci_ctr_express_insert_auth" on public.ci_contratos_express;
drop policy if exists "ci_ctr_express_update_auth" on public.ci_contratos_express;
drop policy if exists "ci_ctr_express_delete_auth" on public.ci_contratos_express;

create policy "ci_ctr_express_select_anon" on public.ci_contratos_express for select to anon using (true);
create policy "ci_ctr_express_insert_anon" on public.ci_contratos_express for insert to anon with check (true);
create policy "ci_ctr_express_update_anon" on public.ci_contratos_express for update to anon using (true) with check (true);
create policy "ci_ctr_express_delete_anon" on public.ci_contratos_express for delete to anon using (true);
create policy "ci_ctr_express_select_auth" on public.ci_contratos_express for select to authenticated using (true);
create policy "ci_ctr_express_insert_auth" on public.ci_contratos_express for insert to authenticated with check (true);
create policy "ci_ctr_express_update_auth" on public.ci_contratos_express for update to authenticated using (true) with check (true);
create policy "ci_ctr_express_delete_auth" on public.ci_contratos_express for delete to authenticated using (true);

grant select, insert, update, delete on public.ci_contratos_express to anon, authenticated, service_role;

notify pgrst, 'reload schema';
