-- Parche corto: ci_flota_alertas ya existía sin columna resuelta/leida.
-- Pegar esto PRIMERO en el SQL Editor. Luego reejecutar
-- sql_editor_aplicar_pendientes_flota.sql (es idempotente).

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
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas' and column_name = 'estado'
  ) then
    update public.ci_flota_alertas
    set
      resuelta = case
        when lower(coalesce(estado, '')) in ('resuelta', 'resuelto') then true
        else resuelta
      end,
      leida = case
        when lower(coalesce(estado, '')) in ('leida', 'leido', 'leído', 'resuelta', 'resuelto') then true
        else leida
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
    set created_at = creada_en
    where creada_en is not null;
  end if;
end $$;

update public.ci_flota_alertas
set
  titulo = coalesce(nullif(btrim(titulo), ''), nullif(btrim(tipo), ''), 'Alerta'),
  severidad = coalesce(nullif(btrim(severidad), ''), 'warning')
where titulo is null or severidad is null;

create index if not exists idx_ci_flota_alertas_abiertas
  on public.ci_flota_alertas (resuelta, severidad, created_at desc);

notify pgrst, 'reload schema';
