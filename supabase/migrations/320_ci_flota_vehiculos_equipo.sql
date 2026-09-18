-- Vincula unidades de flota con el catálogo de maquinaria propia (ci_proyecto_equipos).

alter table public.ci_flota_vehiculos
  add column if not exists equipo_id uuid references public.ci_proyecto_equipos (id) on delete set null,
  add column if not exists nombre text;

create unique index if not exists ci_flota_vehiculos_equipo_id_unique
  on public.ci_flota_vehiculos (equipo_id)
  where equipo_id is not null;

create index if not exists idx_ci_flota_vehiculos_equipo
  on public.ci_flota_vehiculos (equipo_id);

comment on column public.ci_flota_vehiculos.equipo_id is
  'Activo del catálogo de maquinaria propia (ci_proyecto_equipos).';

comment on column public.ci_flota_vehiculos.nombre is
  'Nombre de pila de la unidad (equipo / maquinaria), además de marca y modelo.';

notify pgrst, 'reload schema';
