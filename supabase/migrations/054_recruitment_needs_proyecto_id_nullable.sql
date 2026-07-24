-- Vacantes solo por módulo integral (proyecto_modulo_id): proyecto_id debe poder ser NULL.
-- Error 23502: null value in column "proyecto_id" violates not-null constraint
-- Detección vía pg_catalog (más fiable que information_schema en algunos entornos).

do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'recruitment_needs'
      and a.attname = 'proyecto_id'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    alter table public.recruitment_needs alter column proyecto_id drop not null;
    execute format(
      'comment on column public.recruitment_needs.proyecto_id is %L',
      'FK a ci_obras (Talento). Null cuando la vacante es solo del módulo integral (proyecto_modulo_id).'
    );
  end if;
end $$;

notify pgrst, 'reload schema';
