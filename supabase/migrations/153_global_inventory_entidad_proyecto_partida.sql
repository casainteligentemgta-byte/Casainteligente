-- Inventario: clasificación por entidad (patrono), proyecto de obra y partida Lulo.

alter table public.global_inventory
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

alter table public.global_inventory
  add column if not exists proyecto_id uuid references public.ci_proyectos (id) on delete set null;

alter table public.global_inventory
  add column if not exists presupuesto_partida_id uuid references public.ci_presupuesto_partidas (id) on delete set null;

create index if not exists idx_global_inventory_entidad
  on public.global_inventory (entidad_id)
  where entidad_id is not null;

create index if not exists idx_global_inventory_proyecto
  on public.global_inventory (proyecto_id)
  where proyecto_id is not null;

create index if not exists idx_global_inventory_presupuesto_partida
  on public.global_inventory (presupuesto_partida_id)
  where presupuesto_partida_id is not null;

comment on column public.global_inventory.entidad_id is
  'Entidad legal / patrono (ci_entidades) a la que pertenece el material.';

comment on column public.global_inventory.proyecto_id is
  'Proyecto de obra (ci_proyectos) al que está asignado el inventario.';

comment on column public.global_inventory.presupuesto_partida_id is
  'Partida de presupuesto Lulo (ci_presupuesto_partidas) para imputación de costo.';

notify pgrst, 'reload schema';
