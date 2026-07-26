-- 298: Amplía rol_examen (vigilante + empleado) y alinea catálogo Psique.
-- Idempotente.

-- ci_empleados.rol_examen
alter table public.ci_empleados drop constraint if exists ci_empleados_rol_examen_check;
alter table public.ci_empleados
  add constraint ci_empleados_rol_examen_check
  check (
    rol_examen is null
    or rol_examen in ('programador', 'tecnico', 'obrero', 'vigilante', 'empleado')
  );

comment on column public.ci_empleados.rol_examen is
  'Banco de examen: obrero|vigilante (ABC), tecnico (obra trípode), empleado|programador (frecuencia + lógica).';

-- Catálogo Psique aislado (294)
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
    where nombre_prueba = 'DISC / perfil conductual'
      and coalesce(rol_examen_sugerido, '') <> 'empleado';
  end if;

  -- Tabla legado `pruebas` (290) si existe
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
