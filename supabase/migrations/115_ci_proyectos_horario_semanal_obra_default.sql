-- Horario semanal por defecto en obra (contratos laborales PDF / plantilla); prioridad bajo horario del contrato.

alter table public.ci_proyectos
  add column if not exists horario_semanal_obra_default text;

comment on column public.ci_proyectos.horario_semanal_obra_default is
  'Texto libre (ej. 7:00 a.m. a 4:00 p.m.) usado en contratos si ci_contratos_empleado_obra.horario_semanal_texto está vacío.';
