-- Umbrales globales (licencia_vence, etc.) no llevan unidad.
-- El esquema maquinaria tenía maquinaria_id NOT NULL.

alter table public.ci_flota_alertas_config
  alter column maquinaria_id drop not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ci_flota_alertas_config'
      and column_name = 'tipo_alerta'
      and is_nullable = 'NO'
  ) then
    alter table public.ci_flota_alertas_config
      alter column tipo_alerta drop not null;
  end if;
end $$;

notify pgrst, 'reload schema';
