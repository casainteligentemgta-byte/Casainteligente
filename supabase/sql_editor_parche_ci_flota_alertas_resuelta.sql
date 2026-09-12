-- Parche corto: esquema maquinaria tiene creada_en, no created_at.
-- Pegar esto ANTES de índices o del paquete de flota.

alter table public.ci_flota_alertas
  add column if not exists leida boolean not null default false,
  add column if not exists resuelta boolean not null default false,
  add column if not exists severidad text default 'warning',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists conductor_id uuid,
  add column if not exists vehiculo_id uuid,
  add column if not exists tipo text,
  add column if not exists titulo text,
  add column if not exists mensaje text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas' and column_name = 'creada_en'
  ) then
    update public.ci_flota_alertas
    set created_at = creada_en
    where creada_en is not null;
  end if;
end $$;

alter table public.ci_flota_conductores
  add column if not exists created_at timestamptz default now();

notify pgrst, 'reload schema';

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ci_flota_alertas'
  and column_name in ('leida', 'resuelta', 'estado', 'created_at', 'creada_en', 'severidad')
order by column_name;
