-- Resultado explícito del trípode (incluye rechazado por tiempo).

alter table public.ci_empleados
  add column if not exists status_evaluacion text
  check (
    status_evaluacion is null
    or status_evaluacion in ('verde', 'amarillo', 'rojo', 'rechazado')
  );

comment on column public.ci_empleados.status_evaluacion is
  'Trípode: verde, amarillo, rojo o rechazado (p. ej. tiempo excedido).';
