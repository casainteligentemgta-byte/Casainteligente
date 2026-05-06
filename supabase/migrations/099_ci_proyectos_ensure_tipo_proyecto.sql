-- Columna tipo_proyecto (subconjunto idempotente de 086) para bases que aún no la tienen.
-- Evita errores PostgREST al seleccionar tipo_proyecto explícitamente.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'tipo_proyecto_ci' and n.nspname = 'public'
  ) then
    create type public.tipo_proyecto_ci as enum ('integral', 'talento');
  end if;
end $$;

alter table public.ci_proyectos
  add column if not exists tipo_proyecto public.tipo_proyecto_ci not null default 'integral';

create index if not exists idx_ci_proyectos_tipo on public.ci_proyectos (tipo_proyecto);

notify pgrst, 'reload schema';
