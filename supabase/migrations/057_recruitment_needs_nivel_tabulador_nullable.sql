-- Esquema legacy: nivel_tabulador NOT NULL; el modelo nuevo usa cargo_nivel.

do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'recruitment_needs'
      and a.attname = 'nivel_tabulador'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    alter table public.recruitment_needs alter column nivel_tabulador drop not null;
    execute format(
      'comment on column public.recruitment_needs.nivel_tabulador is %L',
      'Nivel legado del tabulador; opcional si se usa cargo_nivel.'
    );
  end if;
end $$;

notify pgrst, 'reload schema';
