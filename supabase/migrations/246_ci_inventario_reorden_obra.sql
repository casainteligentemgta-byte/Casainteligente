-- Stock mínimo (punto de reorden) por material y obra.
-- Complementa global_inventory.reorder_point (fallback global).

create table if not exists public.ci_inventario_reorden_obra (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  material_id uuid not null references public.global_inventory (id) on delete cascade,
  reorder_point numeric(15, 4) not null default 0 check (reorder_point >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_inventario_reorden_obra_unique unique (proyecto_id, material_id)
);

create index if not exists idx_ci_inventario_reorden_obra_proyecto
  on public.ci_inventario_reorden_obra (proyecto_id);

create index if not exists idx_ci_inventario_reorden_obra_material
  on public.ci_inventario_reorden_obra (material_id);

comment on table public.ci_inventario_reorden_obra is
  'Umbral de stock bajo por obra y material. Si no hay fila, se usa global_inventory.reorder_point.';

alter table public.ci_inventario_reorden_obra enable row level security;

drop policy if exists "ci_inventario_reorden_obra_select" on public.ci_inventario_reorden_obra;
drop policy if exists "ci_inventario_reorden_obra_insert" on public.ci_inventario_reorden_obra;
drop policy if exists "ci_inventario_reorden_obra_update" on public.ci_inventario_reorden_obra;
drop policy if exists "ci_inventario_reorden_obra_delete" on public.ci_inventario_reorden_obra;

create policy "ci_inventario_reorden_obra_select"
  on public.ci_inventario_reorden_obra for select to authenticated using (true);

create policy "ci_inventario_reorden_obra_insert"
  on public.ci_inventario_reorden_obra for insert to authenticated with check (true);

create policy "ci_inventario_reorden_obra_update"
  on public.ci_inventario_reorden_obra for update to authenticated using (true) with check (true);

create policy "ci_inventario_reorden_obra_delete"
  on public.ci_inventario_reorden_obra for delete to authenticated using (true);

notify pgrst, 'reload schema';
