-- Mantenimiento: campos de la API registrarMantenimiento.

alter table public.ci_flota_mantenimiento
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete restrict,
  add column if not exists tipo_mantenimiento text,
  add column if not exists km_actual numeric(12, 1),
  add column if not exists taller_nombre text,
  add column if not exists costo numeric(14, 2),
  add column if not exists fecha_mantenimiento date,
  add column if not exists proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  add column if not exists created_by uuid;

update public.ci_flota_mantenimiento
set
  maquinaria_id = coalesce(maquinaria_id, vehiculo_id),
  tipo_mantenimiento = coalesce(nullif(btrim(tipo_mantenimiento), ''), tipo),
  km_actual = coalesce(km_actual, odometro_km),
  taller_nombre = coalesce(nullif(btrim(taller_nombre), ''), taller),
  costo = coalesce(costo, costo_usd),
  fecha_mantenimiento = coalesce(fecha_mantenimiento, fecha);

create index if not exists idx_ci_flota_mantenimiento_maquinaria
  on public.ci_flota_mantenimiento (maquinaria_id, fecha_mantenimiento desc);

comment on column public.ci_flota_mantenimiento.maquinaria_id is
  'Unidad / maquinaria (alias de vehiculo_id para la API).';
comment on column public.ci_flota_mantenimiento.tipo_mantenimiento is
  'Tipo de servicio; se sincroniza con tipo.';
comment on column public.ci_flota_mantenimiento.fecha_mantenimiento is
  'Fecha del servicio; se sincroniza con fecha.';
comment on column public.ci_flota_mantenimiento.created_by is
  'Usuario auth que registró el servicio.';

notify pgrst, 'reload schema';
