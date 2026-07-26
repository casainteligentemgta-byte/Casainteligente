-- 297: Columnas usadas por vistas RRHH (249) y alta rápida de obrero.
-- `oficio` — texto libre del cargo en campo (además de `cargo`).
-- `status` — pipeline reclutamiento (pendiente, activo, etc.); distinto de `estatus` de cuadrilla.

alter table public.ci_empleados
  add column if not exists oficio text;

alter table public.ci_empleados
  add column if not exists status text;

comment on column public.ci_empleados.oficio is
  'Oficio / cargo declarado en alta rápida o hoja de vida (texto libre).';

comment on column public.ci_empleados.status is
  'Estado de pipeline RRHH (pendiente, activo, baja…). No confundir con estatus de cuadrilla (disponible|asignado|no_disponible).';

notify pgrst, 'reload schema';
