-- Disponibilidad operativa para cuadrilla / asignación (Lean + motor SugerenciaCuadrilla).
-- Idempotente.

alter table public.ci_empleados add column if not exists estatus text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'ci_empleados' and c.conname = 'ci_empleados_estatus_check'
  ) then
    alter table public.ci_empleados
      add constraint ci_empleados_estatus_check
      check (estatus is null or estatus in ('disponible', 'asignado', 'no_disponible'));
  end if;
end $$;

comment on column public.ci_empleados.estatus is
  'Cuadrilla: disponible | asignado | no_disponible. Null se normaliza como no_disponible salvo aprobados.';

update public.ci_empleados
set estatus = 'disponible'
where estatus is null
  and estado = 'aprobado';

update public.ci_empleados
set estatus = 'no_disponible'
where estatus is null
  and (estado is null or estado <> 'aprobado');

create index if not exists idx_ci_empleados_estatus on public.ci_empleados (estatus);

notify pgrst, 'reload schema';
