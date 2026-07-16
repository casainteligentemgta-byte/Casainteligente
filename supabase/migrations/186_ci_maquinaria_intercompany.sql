-- Maquinaria intercompany: maestro vinculado a inventario + parte diario de horas en obra.

alter table public.ci_entidades
  add column if not exists nombre_abreviado text;

comment on column public.ci_entidades.nombre_abreviado is
  'Siglas o nombre corto para UI de campo (p. ej. SMART, CI-MGTA).';

create table if not exists public.ci_maquinaria_maestro (
  id uuid primary key default gen_random_uuid(),
  global_inventory_id uuid not null references public.global_inventory (id) on delete restrict,
  entidad_propietaria_id uuid references public.ci_entidades (id) on delete set null,
  codigo_interno text,
  costo_hora_alquiler_interno numeric(14, 2) not null default 0
    check (costo_hora_alquiler_interno >= 0),
  costo_hora_cliente_final numeric(14, 2) not null default 0
    check (costo_hora_cliente_final >= 0),
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_maquinaria_maestro_inventory_unique unique (global_inventory_id)
);

create index if not exists idx_ci_maquinaria_maestro_entidad
  on public.ci_maquinaria_maestro (entidad_propietaria_id);

comment on table public.ci_maquinaria_maestro is
  'Equipo pesado / maquinaria en inventario con tarifas intercompany y venta a cliente.';

create table if not exists public.ci_maquinaria_control_horas (
  id uuid primary key default gen_random_uuid(),
  ci_proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  maquinaria_id uuid not null references public.ci_maquinaria_maestro (id) on delete restrict,
  ci_presupuesto_partida_id uuid references public.ci_presupuesto_partidas (id) on delete set null,
  fecha_trabajo date not null default current_date,
  horas_trabajadas numeric(10, 2) not null check (horas_trabajadas > 0),
  costo_transferencia_interna numeric(15, 2) not null default 0,
  costo_venta_cliente numeric(15, 2) not null default 0,
  justificacion_uso text,
  observaciones text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_maquinaria_horas_proyecto
  on public.ci_maquinaria_control_horas (ci_proyecto_id, fecha_trabajo desc);

create index if not exists idx_ci_maquinaria_horas_partida
  on public.ci_maquinaria_control_horas (ci_presupuesto_partida_id);

comment on table public.ci_maquinaria_control_horas is
  'Parte diario de horas de maquinaria intercompany imputado a partida Lulo.';

alter table public.ci_maquinaria_maestro enable row level security;
alter table public.ci_maquinaria_control_horas enable row level security;

drop policy if exists "ci_maquinaria_maestro_select_anon" on public.ci_maquinaria_maestro;
drop policy if exists "ci_maquinaria_maestro_insert_anon" on public.ci_maquinaria_maestro;
drop policy if exists "ci_maquinaria_maestro_update_anon" on public.ci_maquinaria_maestro;
drop policy if exists "ci_maquinaria_maestro_delete_anon" on public.ci_maquinaria_maestro;

create policy "ci_maquinaria_maestro_select_anon" on public.ci_maquinaria_maestro for select to anon using (true);
create policy "ci_maquinaria_maestro_insert_anon" on public.ci_maquinaria_maestro for insert to anon with check (true);
create policy "ci_maquinaria_maestro_update_anon" on public.ci_maquinaria_maestro for update to anon using (true) with check (true);
create policy "ci_maquinaria_maestro_delete_anon" on public.ci_maquinaria_maestro for delete to anon using (true);

drop policy if exists "ci_maquinaria_horas_select_anon" on public.ci_maquinaria_control_horas;
drop policy if exists "ci_maquinaria_horas_insert_anon" on public.ci_maquinaria_control_horas;
drop policy if exists "ci_maquinaria_horas_update_anon" on public.ci_maquinaria_control_horas;
drop policy if exists "ci_maquinaria_horas_delete_anon" on public.ci_maquinaria_control_horas;

create policy "ci_maquinaria_horas_select_anon" on public.ci_maquinaria_control_horas for select to anon using (true);
create policy "ci_maquinaria_horas_insert_anon" on public.ci_maquinaria_control_horas for insert to anon with check (true);
create policy "ci_maquinaria_horas_update_anon" on public.ci_maquinaria_control_horas for update to anon using (true) with check (true);
create policy "ci_maquinaria_horas_delete_anon" on public.ci_maquinaria_control_horas for delete to anon using (true);

notify pgrst, 'reload schema';
