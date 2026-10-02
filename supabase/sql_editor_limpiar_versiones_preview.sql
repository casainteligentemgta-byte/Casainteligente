-- Pegar en el SQL Editor de PRODUCCIÓN (proyecto Preview / GitHub).
-- Lista el historial y borra versiones huérfanas que rompen el check:
-- "Remote migration versions not found in local migrations directory."
--
-- Columnas reales: version, name, statements (no existe inserted_at).
-- NO borrar 001 ni 002: esos archivos ya están de nuevo en el repo.
-- 0311 / 0312 / 1980 no deben existir como archivos (el sort del CLI
-- los coloca ANTES que 031_ y 198_ y el check vuelve a fallar).

select column_name, data_type
from information_schema.columns
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations'
order by ordinal_position;

select version, name
from supabase_migrations.schema_migrations
order by version;

delete from supabase_migrations.schema_migrations
where version in ('0311', '0312', '1980')
   or version ~ '_';

notify pgrst, 'reload schema';

select version, name
from supabase_migrations.schema_migrations
where version in ('001', '002', '031', '0311', '0312', '198', '1980', '264')
order by version;
