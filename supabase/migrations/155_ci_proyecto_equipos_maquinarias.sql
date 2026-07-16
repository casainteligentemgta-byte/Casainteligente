-- Maquinarias en inventario de equipos por proyecto: propias y alquiladas (arrendatario, RIF, costo, fechas).

update public.ci_proyecto_equipos
set categoria = 'equipo'
where categoria is null or trim(categoria) = '';

alter table public.ci_proyecto_equipos
  alter column categoria set default 'equipo';

alter table public.ci_proyecto_equipos
  add column if not exists fecha_asignacion date,
  add column if not exists fecha_arriendo_inicio date,
  add column if not exists fecha_arriendo_fin date,
  add column if not exists arrendatario text,
  add column if not exists arrendatario_rif text,
  add column if not exists costo_arriendo numeric(14, 2),
  add column if not exists moneda_arriendo text not null default 'USD';

alter table public.ci_proyecto_equipos
  drop constraint if exists ci_proyecto_equipos_categoria_chk;

alter table public.ci_proyecto_equipos
  add constraint ci_proyecto_equipos_categoria_chk
  check (categoria in ('equipo', 'maquinaria_propia', 'maquinaria_alquilada'));

alter table public.ci_proyecto_equipos
  drop constraint if exists ci_proyecto_equipos_costo_arriendo_nonneg;

alter table public.ci_proyecto_equipos
  add constraint ci_proyecto_equipos_costo_arriendo_nonneg
  check (costo_arriendo is null or costo_arriendo >= 0);

create index if not exists idx_ci_proyecto_equipos_proyecto_categoria
  on public.ci_proyecto_equipos (proyecto_id, categoria);

comment on column public.ci_proyecto_equipos.categoria is
  'equipo | maquinaria_propia | maquinaria_alquilada';

comment on column public.ci_proyecto_equipos.fecha_asignacion is
  'Fecha en que la maquinaria propia quedó asignada a la obra.';

comment on column public.ci_proyecto_equipos.fecha_arriendo_inicio is
  'Inicio del arriendo (maquinaria alquilada).';

comment on column public.ci_proyecto_equipos.fecha_arriendo_fin is
  'Fin del arriendo (maquinaria alquilada).';

comment on column public.ci_proyecto_equipos.arrendatario is
  'Proveedor o arrendador de la maquinaria alquilada.';

comment on column public.ci_proyecto_equipos.arrendatario_rif is
  'RIF del arrendador.';

comment on column public.ci_proyecto_equipos.costo_arriendo is
  'Costo del arriendo en la moneda indicada.';

notify pgrst, 'reload schema';
