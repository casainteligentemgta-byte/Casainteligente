-- Esquema legacy: cantidad_requerida NOT NULL; la API crea una fila por plaza (cantidad 1 por insert).

do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'recruitment_needs'
      and a.attname = 'cantidad_requerida'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    alter table public.recruitment_needs alter column cantidad_requerida drop not null;
    execute format(
      'comment on column public.recruitment_needs.cantidad_requerida is %L',
      'Plazas pedidas (legado); la API actual inserta una fila por plaza.'
    );
  end if;
end $$;

notify pgrst, 'reload schema';
