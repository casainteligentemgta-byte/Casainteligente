-- Gasolina: campos de la API registrarGasolina (maquinaria_id, litros, km, created_by).

alter table public.ci_flota_gasolina
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete restrict,
  add column if not exists cantidad_litros numeric(10, 2),
  add column if not exists costo_total numeric(14, 2),
  add column if not exists km_actual numeric(12, 1),
  add column if not exists tipo_gasolina text,
  add column if not exists estacion_gasolina text,
  add column if not exists created_by uuid;

update public.ci_flota_gasolina
set
  maquinaria_id = coalesce(maquinaria_id, vehiculo_id),
  cantidad_litros = coalesce(cantidad_litros, litros),
  costo_total = coalesce(costo_total, monto_usd),
  km_actual = coalesce(km_actual, odometro_km),
  estacion_gasolina = coalesce(nullif(btrim(estacion_gasolina), ''), estacion);

create index if not exists idx_ci_flota_gasolina_maquinaria
  on public.ci_flota_gasolina (maquinaria_id, created_at desc);

comment on column public.ci_flota_gasolina.maquinaria_id is
  'Unidad / maquinaria (alias de vehiculo_id para la API).';
comment on column public.ci_flota_gasolina.cantidad_litros is
  'Litros cargados; se sincroniza con litros.';
comment on column public.ci_flota_gasolina.km_actual is
  'Odómetro al cargar; se sincroniza con odometro_km.';
comment on column public.ci_flota_gasolina.created_by is
  'Usuario auth que registró la carga.';

notify pgrst, 'reload schema';
