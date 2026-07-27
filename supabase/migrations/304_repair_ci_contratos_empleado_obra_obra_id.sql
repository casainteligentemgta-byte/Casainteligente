-- Repara entornos donde ci_contratos_empleado_obra perdió `obra_id`
-- (error: column ci_contratos_empleado_obra.obra_id does not exist).
-- Asegura obra_id + proyecto_id y los sincroniza.

do $$
begin
  if to_regclass('public.ci_contratos_empleado_obra') is null then
    raise notice 'ci_contratos_empleado_obra no existe; se omite repair';
    return;
  end if;

  -- proyecto_id (añadido en 068; puede faltar en clones viejos)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ci_contratos_empleado_obra'
      and column_name = 'proyecto_id'
  ) then
    alter table public.ci_contratos_empleado_obra
      add column proyecto_id uuid references public.ci_proyectos (id) on delete restrict;
  end if;

  -- obra_id (columna original 025; algunos prod solo tienen proyecto_id)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ci_contratos_empleado_obra'
      and column_name = 'obra_id'
  ) then
    alter table public.ci_contratos_empleado_obra
      add column obra_id uuid references public.ci_proyectos (id) on delete restrict;
  end if;
end;
$$;

-- Sincronizar ambas columnas cuando una esté vacía.
update public.ci_contratos_empleado_obra
set obra_id = proyecto_id
where obra_id is null
  and proyecto_id is not null;

update public.ci_contratos_empleado_obra
set proyecto_id = obra_id
where proyecto_id is null
  and obra_id is not null;

create index if not exists idx_ci_contratos_empleado_obra_obra_id
  on public.ci_contratos_empleado_obra (obra_id);

create index if not exists idx_ci_contratos_empleado_obra_proyecto_id
  on public.ci_contratos_empleado_obra (proyecto_id);

comment on column public.ci_contratos_empleado_obra.obra_id is
  'Sitio/obra (ci_proyectos.id). Alias histórico; mantener alineado con proyecto_id.';
comment on column public.ci_contratos_empleado_obra.proyecto_id is
  'Proyecto/módulo (ci_proyectos.id). Preferido en código nuevo; alineado con obra_id.';

notify pgrst, 'reload schema';
