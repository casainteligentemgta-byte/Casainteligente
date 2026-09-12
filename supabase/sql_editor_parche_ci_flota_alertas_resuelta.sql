-- SOLO estas líneas. No pegar el paquete grande todavía.
-- Añade leida/resuelta si ci_flota_alertas ya existía sin ellas.

alter table public.ci_flota_alertas
  add column if not exists leida boolean not null default false,
  add column if not exists resuelta boolean not null default false;

notify pgrst, 'reload schema';

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ci_flota_alertas'
  and column_name in ('leida', 'resuelta', 'estado', 'created_at')
order by column_name;
