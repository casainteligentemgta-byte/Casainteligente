-- Alertas: config por maquinaria (km/días) y alertas con estado/creada_en.

alter table public.ci_flota_alertas_config
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists tipo_alerta text,
  add column if not exists frecuencia_tipo text
    check (frecuencia_tipo is null or frecuencia_tipo in ('km', 'dias')),
  add column if not exists frecuencia_valor numeric(12, 1)
    check (frecuencia_valor is null or frecuencia_valor >= 0),
  add column if not exists proxima_alerta_km numeric(12, 1),
  add column if not exists proxima_alerta_fecha date;

alter table public.ci_flota_alertas_config
  drop constraint if exists ci_flota_alertas_config_tipo_unique;

create unique index if not exists ci_flota_alertas_config_tipo_global
  on public.ci_flota_alertas_config (tipo)
  where maquinaria_id is null;

create unique index if not exists ci_flota_alertas_config_maq_tipo
  on public.ci_flota_alertas_config (maquinaria_id, tipo_alerta)
  where maquinaria_id is not null;

update public.ci_flota_alertas_config
set
  tipo_alerta = coalesce(nullif(btrim(tipo_alerta), ''), tipo),
  frecuencia_tipo = coalesce(
    frecuencia_tipo,
    case when tipo = 'mantenimiento_km' then 'km' else 'dias' end
  ),
  frecuencia_valor = coalesce(frecuencia_valor, dias_anticipacion);

alter table public.ci_flota_alertas
  add column if not exists config_id uuid references public.ci_flota_alertas_config (id) on delete set null,
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists tipo_alerta text,
  add column if not exists descripcion text,
  add column if not exists fecha_vencimiento date,
  add column if not exists km_vencimiento numeric(12, 1),
  add column if not exists estado text not null default 'pendiente'
    check (estado in ('pendiente', 'leida', 'resuelta')),
  add column if not exists creada_en timestamptz;

update public.ci_flota_alertas
set
  maquinaria_id = coalesce(maquinaria_id, vehiculo_id),
  tipo_alerta = coalesce(nullif(btrim(tipo_alerta), ''), tipo),
  descripcion = coalesce(descripcion, mensaje),
  fecha_vencimiento = coalesce(fecha_vencimiento, vence_el),
  creada_en = coalesce(creada_en, created_at),
  estado = case
    when resuelta then 'resuelta'
    when leida then 'leida'
    else coalesce(nullif(btrim(estado), ''), 'pendiente')
  end;

alter table public.ci_flota_alertas
  alter column creada_en set default now();

update public.ci_flota_alertas
set creada_en = created_at
where creada_en is null;

alter table public.ci_flota_alertas
  alter column creada_en set not null;

create index if not exists idx_ci_flota_alertas_pendientes
  on public.ci_flota_alertas (estado, creada_en desc)
  where estado = 'pendiente';

create index if not exists idx_ci_flota_alertas_maquinaria
  on public.ci_flota_alertas (maquinaria_id, creada_en desc);

create index if not exists idx_ci_flota_alertas_config_maq
  on public.ci_flota_alertas_config (maquinaria_id, tipo_alerta);

comment on column public.ci_flota_alertas_config.maquinaria_id is
  'Unidad de la regla (null = umbral global del módulo).';
comment on column public.ci_flota_alertas.estado is
  'pendiente | leida | resuelta; se sincroniza con leida/resuelta.';
comment on column public.ci_flota_alertas.creada_en is
  'Fecha de generación; alias de created_at para la API.';

notify pgrst, 'reload schema';
