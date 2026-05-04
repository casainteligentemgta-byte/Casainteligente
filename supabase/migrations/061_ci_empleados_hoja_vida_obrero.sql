-- Campos ampliados de hoja de vida del obrero (obra, emergencia, salud).

alter table public.ci_empleados
  add column if not exists fecha_nacimiento text,
  add column if not exists ciudad_estado text,
  add column if not exists direccion_habitacion text,
  add column if not exists contacto_emergencia_nombre text,
  add column if not exists contacto_emergencia_telefono text,
  add column if not exists anos_experiencia_obra text,
  add column if not exists eps_seguro text,
  add column if not exists grupo_sanguineo text,
  add column if not exists alergias_notas text;

comment on column public.ci_empleados.fecha_nacimiento is 'Fecha de nacimiento (texto libre o ISO).';
comment on column public.ci_empleados.direccion_habitacion is 'Dirección de habitación del obrero.';
comment on column public.ci_empleados.contacto_emergencia_nombre is 'Familiar o contacto en caso de emergencia.';
comment on column public.ci_empleados.anos_experiencia_obra is 'Experiencia declarada en obra similar.';
