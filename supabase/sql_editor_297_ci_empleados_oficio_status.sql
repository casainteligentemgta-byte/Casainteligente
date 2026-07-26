-- SQL Editor: migración 297 — ci_empleados.oficio + status (RRHH / alta rápida)
-- Ejecutar si la vista 249 o el alta rápida fallan por columnas faltantes.

alter table public.ci_empleados
  add column if not exists oficio text;

alter table public.ci_empleados
  add column if not exists status text;

comment on column public.ci_empleados.oficio is
  'Oficio / cargo declarado en alta rápida o hoja de vida (texto libre).';

comment on column public.ci_empleados.status is
  'Estado de pipeline RRHH (pendiente, activo, baja…). No confundir con estatus de cuadrilla (disponible|asignado|no_disponible).';

notify pgrst, 'reload schema';
