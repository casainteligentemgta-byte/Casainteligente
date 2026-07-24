-- Ventana de asignación: inicio/fin explícitos (null en end_date = asignación activa).

alter table public.project_assignments
  add column if not exists start_date timestamptz not null default now();

alter table public.project_assignments
  add column if not exists end_date timestamptz null;

comment on column public.project_assignments.start_date is 'Inicio de la asignación del trabajador a la solicitud.';
comment on column public.project_assignments.end_date is 'Fin de asignación; null significa activa.';

notify pgrst, 'reload schema';
