-- ci_flota_alertas_config ya existía (esquema maquinaria) sin columna tipo.

alter table public.ci_flota_alertas_config
  add column if not exists tipo text,
  add column if not exists tipo_alerta text,
  add column if not exists dias_anticipacion integer default 15,
  add column if not exists umbral_consumo_km_l numeric(8, 2),
  add column if not exists activa boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas_config' and column_name = 'tipo_alerta'
  ) then
    update public.ci_flota_alertas_config
    set tipo = coalesce(nullif(btrim(tipo), ''), tipo_alerta)
    where tipo is null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas_config' and column_name = 'activo'
  ) then
    update public.ci_flota_alertas_config
    set activa = coalesce(activa, activo);
  end if;
end $$;

notify pgrst, 'reload schema';

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ci_flota_alertas_config'
order by ordinal_position;
