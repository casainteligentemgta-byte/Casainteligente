-- Listar versiones remotas para comparar con supabase/migrations/
select version, name, left(coalesce(array_to_string(statements, E'\n'), ''), 80) as statements_preview
from supabase_migrations.schema_migrations
order by version;
