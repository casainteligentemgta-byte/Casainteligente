-- Activos del patrono: categoría herramienta, fotos por 4 costados y ubicación en almacén/obra.

alter table public.ci_proyecto_equipos
  drop constraint if exists ci_proyecto_equipos_categoria_chk;

alter table public.ci_proyecto_equipos
  add constraint ci_proyecto_equipos_categoria_chk
  check (
    categoria in (
      'equipo',
      'herramienta',
      'maquinaria_propia',
      'maquinaria_alquilada'
    )
  );

alter table public.ci_proyecto_equipos
  add column if not exists ubicacion_id uuid
    references public.inv_ubicaciones (id) on delete set null;

alter table public.ci_proyecto_equipos
  add column if not exists fotos_costados jsonb not null default '{}'::jsonb;

create index if not exists idx_ci_proyecto_equipos_ubicacion
  on public.ci_proyecto_equipos (ubicacion_id)
  where ubicacion_id is not null;

comment on column public.ci_proyecto_equipos.categoria is
  'equipo | herramienta | maquinaria_propia | maquinaria_alquilada';

comment on column public.ci_proyecto_equipos.ubicacion_id is
  'Ubicación actual en inventario (almacén u obra vía inv_ubicaciones).';

comment on column public.ci_proyecto_equipos.fotos_costados is
  'Fotos por costado: { frente, atras, izquierda, derecha } con { url, storage_path }.';

notify pgrst, 'reload schema';
