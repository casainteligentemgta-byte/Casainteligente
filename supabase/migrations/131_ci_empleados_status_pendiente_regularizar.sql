-- Permite `pendiente_regularizar` y estados de examen obrero en `status_evaluacion`.

alter table public.ci_empleados drop constraint if exists ci_empleados_status_evaluacion_check;

alter table public.ci_empleados
  add constraint ci_empleados_status_evaluacion_check
  check (
    status_evaluacion is null
    or status_evaluacion in (
      'verde',
      'amarillo',
      'rojo',
      'rechazado',
      'aprobado',
      'aprobado_con_observaciones',
      'reprobado',
      'pendiente_regularizar'
    )
  );

comment on column public.ci_empleados.status_evaluacion is
  'Resultado evaluación: colores semáforo, aprobado/rechazado, o pendiente_regularizar (express sin examen).';
