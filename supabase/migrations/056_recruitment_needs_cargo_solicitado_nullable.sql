-- Esquemas legacy: cargo_solicitado NOT NULL sin default; el modelo nuevo usa cargo_codigo / cargo_nombre.

do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'recruitment_needs'
      and a.attname = 'cargo_solicitado'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    alter table public.recruitment_needs alter column cargo_solicitado drop not null;
    execute format(
      'comment on column public.recruitment_needs.cargo_solicitado is %L',
      'Texto legado del cargo; opcional si se usan cargo_codigo y cargo_nombre.'
    );
  end if;
end $$;

notify pgrst, 'reload schema';
