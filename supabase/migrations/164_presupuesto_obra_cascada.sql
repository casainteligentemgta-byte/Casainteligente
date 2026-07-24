-- Presupuesto de obra normalizado en cascada: proyectos → capítulos → partidas → apu_items.
-- Esquema relacional para importación Lulo y control de compras/inventario.

create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ubicacion text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.proyectos is
  'Proyectos de obra con presupuesto en cascada (capítulos → partidas → APU).';

create table if not exists public.capitulos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  constraint capitulos_proyecto_codigo_unique unique (proyecto_id, codigo)
);

create index if not exists idx_capitulos_proyecto_id
  on public.capitulos (proyecto_id);

comment on table public.capitulos is
  'Capítulos del presupuesto (ej. 01 Pared Limítrofe) por proyecto.';

create table if not exists public.partidas (
  id uuid primary key default gen_random_uuid(),
  capitulo_id uuid not null references public.capitulos (id) on delete cascade,
  codigo text not null,
  descripcion text not null default '',
  unidad text not null default 'UND',
  cantidad_presupuestada numeric(12, 2) not null default 0,
  constraint partidas_capitulo_codigo_unique unique (capitulo_id, codigo),
  constraint partidas_cantidad_no_negativa check (cantidad_presupuestada >= 0)
);

create index if not exists idx_partidas_capitulo_id
  on public.partidas (capitulo_id);

create index if not exists idx_partidas_codigo
  on public.partidas (codigo);

comment on table public.partidas is
  'Partidas de presupuesto Lulo vinculadas a un capítulo.';

create table if not exists public.apu_items (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas (id) on delete cascade,
  tipo text not null,
  codigo_insumo text not null default '',
  descripcion text not null default '',
  unidad text not null default 'UND',
  rendimiento numeric(12, 4) not null default 0,
  costo_unitario numeric(12, 2) not null default 0,
  constraint apu_items_tipo_check check (tipo in ('material', 'mano_obra', 'equipo')),
  constraint apu_items_rendimiento_no_negativo check (rendimiento >= 0),
  constraint apu_items_costo_no_negativo check (costo_unitario >= 0)
);

create index if not exists idx_apu_items_partida_id
  on public.apu_items (partida_id);

create index if not exists idx_apu_items_tipo
  on public.apu_items (partida_id, tipo);

create index if not exists idx_apu_items_codigo_insumo
  on public.apu_items (codigo_insumo);

comment on table public.apu_items is
  'Desglose APU por partida: materiales, mano de obra y equipos (rendimiento × costo unitario).';

-- Row Level Security
alter table public.proyectos enable row level security;
alter table public.capitulos enable row level security;
alter table public.partidas enable row level security;
alter table public.apu_items enable row level security;

-- proyectos
drop policy if exists "proyectos_select_anon" on public.proyectos;
drop policy if exists "proyectos_insert_anon" on public.proyectos;
drop policy if exists "proyectos_update_anon" on public.proyectos;
drop policy if exists "proyectos_delete_anon" on public.proyectos;
drop policy if exists "proyectos_select_authenticated" on public.proyectos;
drop policy if exists "proyectos_insert_authenticated" on public.proyectos;
drop policy if exists "proyectos_update_authenticated" on public.proyectos;
drop policy if exists "proyectos_delete_authenticated" on public.proyectos;

create policy "proyectos_select_anon" on public.proyectos for select to anon using (true);
create policy "proyectos_insert_anon" on public.proyectos for insert to anon with check (true);
create policy "proyectos_update_anon" on public.proyectos for update to anon using (true) with check (true);
create policy "proyectos_delete_anon" on public.proyectos for delete to anon using (true);

create policy "proyectos_select_authenticated" on public.proyectos for select to authenticated using (true);
create policy "proyectos_insert_authenticated" on public.proyectos for insert to authenticated with check (true);
create policy "proyectos_update_authenticated" on public.proyectos for update to authenticated using (true) with check (true);
create policy "proyectos_delete_authenticated" on public.proyectos for delete to authenticated using (true);

-- capitulos
drop policy if exists "capitulos_select_anon" on public.capitulos;
drop policy if exists "capitulos_insert_anon" on public.capitulos;
drop policy if exists "capitulos_update_anon" on public.capitulos;
drop policy if exists "capitulos_delete_anon" on public.capitulos;
drop policy if exists "capitulos_select_authenticated" on public.capitulos;
drop policy if exists "capitulos_insert_authenticated" on public.capitulos;
drop policy if exists "capitulos_update_authenticated" on public.capitulos;
drop policy if exists "capitulos_delete_authenticated" on public.capitulos;

create policy "capitulos_select_anon" on public.capitulos for select to anon using (true);
create policy "capitulos_insert_anon" on public.capitulos for insert to anon with check (true);
create policy "capitulos_update_anon" on public.capitulos for update to anon using (true) with check (true);
create policy "capitulos_delete_anon" on public.capitulos for delete to anon using (true);

create policy "capitulos_select_authenticated" on public.capitulos for select to authenticated using (true);
create policy "capitulos_insert_authenticated" on public.capitulos for insert to authenticated with check (true);
create policy "capitulos_update_authenticated" on public.capitulos for update to authenticated using (true) with check (true);
create policy "capitulos_delete_authenticated" on public.capitulos for delete to authenticated using (true);

-- partidas
drop policy if exists "partidas_select_anon" on public.partidas;
drop policy if exists "partidas_insert_anon" on public.partidas;
drop policy if exists "partidas_update_anon" on public.partidas;
drop policy if exists "partidas_delete_anon" on public.partidas;
drop policy if exists "partidas_select_authenticated" on public.partidas;
drop policy if exists "partidas_insert_authenticated" on public.partidas;
drop policy if exists "partidas_update_authenticated" on public.partidas;
drop policy if exists "partidas_delete_authenticated" on public.partidas;

create policy "partidas_select_anon" on public.partidas for select to anon using (true);
create policy "partidas_insert_anon" on public.partidas for insert to anon with check (true);
create policy "partidas_update_anon" on public.partidas for update to anon using (true) with check (true);
create policy "partidas_delete_anon" on public.partidas for delete to anon using (true);

create policy "partidas_select_authenticated" on public.partidas for select to authenticated using (true);
create policy "partidas_insert_authenticated" on public.partidas for insert to authenticated with check (true);
create policy "partidas_update_authenticated" on public.partidas for update to authenticated using (true) with check (true);
create policy "partidas_delete_authenticated" on public.partidas for delete to authenticated using (true);

-- apu_items
drop policy if exists "apu_items_select_anon" on public.apu_items;
drop policy if exists "apu_items_insert_anon" on public.apu_items;
drop policy if exists "apu_items_update_anon" on public.apu_items;
drop policy if exists "apu_items_delete_anon" on public.apu_items;
drop policy if exists "apu_items_select_authenticated" on public.apu_items;
drop policy if exists "apu_items_insert_authenticated" on public.apu_items;
drop policy if exists "apu_items_update_authenticated" on public.apu_items;
drop policy if exists "apu_items_delete_authenticated" on public.apu_items;

create policy "apu_items_select_anon" on public.apu_items for select to anon using (true);
create policy "apu_items_insert_anon" on public.apu_items for insert to anon with check (true);
create policy "apu_items_update_anon" on public.apu_items for update to anon using (true) with check (true);
create policy "apu_items_delete_anon" on public.apu_items for delete to anon using (true);

create policy "apu_items_select_authenticated" on public.apu_items for select to authenticated using (true);
create policy "apu_items_insert_authenticated" on public.apu_items for insert to authenticated with check (true);
create policy "apu_items_update_authenticated" on public.apu_items for update to authenticated using (true) with check (true);
create policy "apu_items_delete_authenticated" on public.apu_items for delete to authenticated using (true);

notify pgrst, 'reload schema';
