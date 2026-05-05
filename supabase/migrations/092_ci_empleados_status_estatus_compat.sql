-- Compatibilidad entre status_evaluacion (legacy) y estatus_evaluacion (obrero).
-- Evita errores en entornos donde solo existe una de las dos.

alter table public.ci_empleados
  add column if not exists estatus_evaluacion text;

alter table public.ci_empleados
  add column if not exists status_evaluacion text;

-- Rellena huecos en ambos sentidos para mantener consistencia histórica.
update public.ci_empleados
set estatus_evaluacion = case
  when status_evaluacion in ('verde', 'amarillo', 'rojo', 'rechazado') then 'completado'
  when status_evaluacion is null then estatus_evaluacion
  else estatus_evaluacion
end
where estatus_evaluacion is null;

update public.ci_empleados
set status_evaluacion = case
  when estatus_evaluacion = 'completado' then coalesce(status_evaluacion, 'verde')
  when estatus_evaluacion = 'iniciado' then coalesce(status_evaluacion, 'amarillo')
  else status_evaluacion
end
where status_evaluacion is null;

alter table public.ci_empleados
  drop constraint if exists ci_empleados_estatus_evaluacion_check;

alter table public.ci_empleados
  add constraint ci_empleados_estatus_evaluacion_check
  check (estatus_evaluacion is null or estatus_evaluacion in ('completado', 'iniciado'));

alter table public.ci_empleados
  drop constraint if exists ci_empleados_status_evaluacion_check;

alter table public.ci_empleados
  add constraint ci_empleados_status_evaluacion_check
  check (status_evaluacion is null or status_evaluacion in ('verde', 'amarillo', 'rojo', 'rechazado'));

create or replace function public.ci_empleados_sync_status_estatus()
returns trigger
language plpgsql
as $$
begin
  if new.estatus_evaluacion is not null and new.status_evaluacion is null then
    if new.estatus_evaluacion = 'completado' then
      new.status_evaluacion := 'verde';
    elsif new.estatus_evaluacion = 'iniciado' then
      new.status_evaluacion := 'amarillo';
    end if;
  end if;

  if new.status_evaluacion is not null and new.estatus_evaluacion is null then
    if new.status_evaluacion in ('verde', 'amarillo', 'rojo', 'rechazado') then
      new.estatus_evaluacion := 'completado';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_ci_empleados_sync_status_estatus on public.ci_empleados;
create trigger tr_ci_empleados_sync_status_estatus
before insert or update on public.ci_empleados
for each row execute function public.ci_empleados_sync_status_estatus();

notify pgrst, 'reload schema';
