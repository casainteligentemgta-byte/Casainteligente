-- SQL Editor: migración 298 — rol_examen vigilante + empleado
-- Ejecutar si falla INSERT con rol_examen = 'vigilante' | 'empleado'.

alter table public.ci_empleados drop constraint if exists ci_empleados_rol_examen_check;
alter table public.ci_empleados
  add constraint ci_empleados_rol_examen_check
  check (
    rol_examen is null
    or rol_examen in ('programador', 'tecnico', 'obrero', 'vigilante', 'empleado')
  );

do $$
begin
  if to_regclass('public.ci_psique_pruebas') is not null then
    alter table public.ci_psique_pruebas drop constraint if exists ci_psique_pruebas_rol_examen_sugerido_check;
    alter table public.ci_psique_pruebas
      add constraint ci_psique_pruebas_rol_examen_sugerido_check
      check (
        rol_examen_sugerido is null
        or rol_examen_sugerido in ('programador', 'tecnico', 'obrero', 'vigilante', 'empleado')
      );

    update public.ci_psique_pruebas
    set rol_examen_sugerido = 'empleado'
    where nombre_prueba = 'DISC / perfil conductual';
  end if;

  if to_regclass('public.pruebas') is not null then
    alter table public.pruebas drop constraint if exists pruebas_rol_examen_sugerido_check;
    alter table public.pruebas
      add constraint pruebas_rol_examen_sugerido_check
      check (
        rol_examen_sugerido is null
        or rol_examen_sugerido in ('programador', 'tecnico', 'obrero', 'vigilante', 'empleado')
      );
  end if;
end $$;

notify pgrst, 'reload schema';
