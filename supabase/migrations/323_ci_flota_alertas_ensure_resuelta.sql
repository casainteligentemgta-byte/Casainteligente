-- Asegura leida/resuelta y columnas canónicas de ci_flota_alertas.
-- Necesario cuando la tabla ya existía (esquema maquinaria) y 313 no pudo
-- añadir columnas porque usó CREATE TABLE IF NOT EXISTS.

alter table public.ci_flota_alertas
  add column if not exists tipo text,
  add column if not exists severidad text default 'warning',
  add column if not exists titulo text,
  add column if not exists mensaje text,
  add column if not exists conductor_id uuid references public.ci_flota_conductores (id) on delete cascade,
  add column if not exists vehiculo_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists referencia_id uuid,
  add column if not exists vence_el date,
  add column if not exists leida boolean not null default false,
  add column if not exists resuelta boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists config_id uuid references public.ci_flota_alertas_config (id) on delete set null,
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists tipo_alerta text,
  add column if not exists descripcion text,
  add column if not exists fecha_vencimiento date,
  add column if not exists km_vencimiento numeric(12, 1),
  add column if not exists estado text default 'pendiente',
  add column if not exists creada_en timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas' and column_name = 'estado'
  ) then
    update public.ci_flota_alertas
    set
      resuelta = case
        when resuelta then true
        when lower(coalesce(estado, '')) in ('resuelta', 'resuelto') then true
        else false
      end,
      leida = case
        when leida or resuelta then true
        when lower(coalesce(estado, '')) in ('leida', 'leido', 'leído', 'resuelta', 'resuelto') then true
        else false
      end,
      estado = case
        when resuelta then 'resuelta'
        when leida then 'leida'
        when lower(coalesce(estado, '')) in ('abierta', 'abierto', 'nueva', 'nuevo') then 'pendiente'
        else coalesce(nullif(btrim(estado), ''), 'pendiente')
      end;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas' and column_name = 'detalle'
  ) then
    update public.ci_flota_alertas
    set mensaje = coalesce(mensaje, detalle)
    where mensaje is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas' and column_name = 'creada_en'
  ) then
    update public.ci_flota_alertas
    set
      created_at = coalesce(created_at, creada_en),
      creada_en = coalesce(creada_en, created_at)
    where creada_en is null or created_at is distinct from creada_en;
  end if;
end $$;

update public.ci_flota_alertas
set
  titulo = coalesce(nullif(btrim(titulo), ''), nullif(btrim(tipo), ''), nullif(btrim(tipo_alerta), ''), 'Alerta'),
  severidad = coalesce(nullif(btrim(severidad), ''), 'warning')
where titulo is null or severidad is null;

create index if not exists idx_ci_flota_alertas_abiertas
  on public.ci_flota_alertas (resuelta, severidad, created_at desc);

notify pgrst, 'reload schema';
