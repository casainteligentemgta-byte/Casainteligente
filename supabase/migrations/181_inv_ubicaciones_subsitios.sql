-- Subsitios jerárquicos bajo almacenes y obras (estantes, camionetas, zonas de obra).

alter table public.inv_ubicaciones
  add column if not exists descripcion text;

alter table public.inv_ubicaciones
  add column if not exists ubicacion_padre_id uuid
  references public.inv_ubicaciones (id) on delete cascade;

create index if not exists idx_inv_ubicaciones_padre
  on public.inv_ubicaciones (ubicacion_padre_id)
  where ubicacion_padre_id is not null;

alter table public.inv_ubicaciones
  drop constraint if exists inv_ubicaciones_tipo_obra;

alter table public.inv_ubicaciones
  add constraint inv_ubicaciones_tipo_obra check (
    tipo <> 'obra'
    or ci_proyecto_id is not null
    or ubicacion_padre_id is not null
  );

alter table public.inv_ubicaciones
  drop constraint if exists inv_ubicaciones_no_self_parent;

alter table public.inv_ubicaciones
  add constraint inv_ubicaciones_no_self_parent check (
    ubicacion_padre_id is null or ubicacion_padre_id <> id
  );

comment on column public.inv_ubicaciones.ubicacion_padre_id is
  'Subsitio dentro de un almacén u obra (ej. estante, camioneta, bodega zona).';

notify pgrst, 'reload schema';
