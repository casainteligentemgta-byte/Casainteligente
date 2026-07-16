-- Texto libre: puesto o rol que el candidato declara buscar (independiente del perfil de lógica).

alter table public.ci_empleados
  add column if not exists rol_buscado text;

comment on column public.ci_empleados.rol_buscado is
  'Rol o puesto al que aplica (texto libre). rol_examen sigue siendo programador|tecnico para las preguntas de lógica.';
