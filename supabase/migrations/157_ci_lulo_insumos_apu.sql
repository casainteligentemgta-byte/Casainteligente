-- Maestro de insumos Lulo y composición APU por partida de presupuesto.

create table if not exists public.ci_lulo_insumos_maestro (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  descripcion text not null default '',
  unidad text not null default 'UND',
  precio_base numeric(15, 4) not null default 0,
  tipo text,
  origen text not null default 'lulo_mdb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_lulo_insumos_maestro_codigo_unique unique (codigo)
);

create index if not exists idx_ci_lulo_insumos_maestro_tipo
  on public.ci_lulo_insumos_maestro (tipo);

comment on table public.ci_lulo_insumos_maestro is
  'Catálogo global de insumos importados desde Lulo (M/E/P).';

create table if not exists public.ci_presupuesto_partida_apu (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.ci_presupuesto_partidas (id) on delete cascade,
  insumo_id uuid not null references public.ci_lulo_insumos_maestro (id) on delete restrict,
  cantidad_rendimiento numeric(15, 6) not null default 0,
  desperdicio_porcentaje numeric(8, 4) not null default 0,
  origen text not null default 'lulo_mdb',
  created_at timestamptz not null default now(),
  constraint ci_presupuesto_partida_apu_unique unique (partida_id, insumo_id)
);

create index if not exists idx_ci_presupuesto_partida_apu_partida
  on public.ci_presupuesto_partida_apu (partida_id);

create index if not exists idx_ci_presupuesto_partida_apu_insumo
  on public.ci_presupuesto_partida_apu (insumo_id);

comment on table public.ci_presupuesto_partida_apu is
  'Composición APU: rendimiento de insumo por partida de presupuesto.';

alter table public.ci_proyectos
  add column if not exists codigo_lulo text;

alter table public.ci_proyectos
  add column if not exists porcentaje_admin numeric(8, 4);

alter table public.ci_proyectos
  add column if not exists porcentaje_utilidad numeric(8, 4);

alter table public.ci_proyectos
  add column if not exists porcentaje_fcm numeric(8, 4);

comment on column public.ci_proyectos.codigo_lulo is 'Código de obra en Lulo (Cod_Obr).';
comment on column public.ci_proyectos.porcentaje_admin is 'Porcentaje administración Lulo (Per_Adm).';
comment on column public.ci_proyectos.porcentaje_utilidad is 'Porcentaje utilidad Lulo (Per_Uti).';
comment on column public.ci_proyectos.porcentaje_fcm is 'Factor costo mayor / mano de obra Lulo (Per_Fcm).';

alter table public.ci_lulo_insumos_maestro enable row level security;
alter table public.ci_presupuesto_partida_apu enable row level security;

drop policy if exists "ci_lulo_insumos_maestro_select_anon" on public.ci_lulo_insumos_maestro;
drop policy if exists "ci_lulo_insumos_maestro_insert_anon" on public.ci_lulo_insumos_maestro;
drop policy if exists "ci_lulo_insumos_maestro_update_anon" on public.ci_lulo_insumos_maestro;
drop policy if exists "ci_lulo_insumos_maestro_delete_anon" on public.ci_lulo_insumos_maestro;

create policy "ci_lulo_insumos_maestro_select_anon" on public.ci_lulo_insumos_maestro for select to anon using (true);
create policy "ci_lulo_insumos_maestro_insert_anon" on public.ci_lulo_insumos_maestro for insert to anon with check (true);
create policy "ci_lulo_insumos_maestro_update_anon" on public.ci_lulo_insumos_maestro for update to anon using (true) with check (true);
create policy "ci_lulo_insumos_maestro_delete_anon" on public.ci_lulo_insumos_maestro for delete to anon using (true);

drop policy if exists "ci_presupuesto_partida_apu_select_anon" on public.ci_presupuesto_partida_apu;
drop policy if exists "ci_presupuesto_partida_apu_insert_anon" on public.ci_presupuesto_partida_apu;
drop policy if exists "ci_presupuesto_partida_apu_update_anon" on public.ci_presupuesto_partida_apu;
drop policy if exists "ci_presupuesto_partida_apu_delete_anon" on public.ci_presupuesto_partida_apu;

create policy "ci_presupuesto_partida_apu_select_anon" on public.ci_presupuesto_partida_apu for select to anon using (true);
create policy "ci_presupuesto_partida_apu_insert_anon" on public.ci_presupuesto_partida_apu for insert to anon with check (true);
create policy "ci_presupuesto_partida_apu_update_anon" on public.ci_presupuesto_partida_apu for update to anon using (true) with check (true);
create policy "ci_presupuesto_partida_apu_delete_anon" on public.ci_presupuesto_partida_apu for delete to anon using (true);

notify pgrst, 'reload schema';
