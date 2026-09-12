-- Pegar en el SQL Editor de PRODUCCIÓN (y del Preview si puedes abrirlo).
-- Quita versiones huérfanas que rompen Supabase Preview:
-- el CLI compara historial remoto vs archivos locales; 0311/0312 ordenan
-- ANTES que 031_*.sql y el check dice "Remote migration versions not found".

delete from supabase_migrations.schema_migrations
where version in ('0311', '0312', '1980');

notify pgrst, 'reload schema';

select version, name
from supabase_migrations.schema_migrations
where version in ('031', '0311', '0312', '198', '1980', '320')
order by version;
