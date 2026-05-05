 Observaciones internas de RRHH por obrero (visible en /rrhh/hojas-vida).
-- Idempotente.

alter table public.ci_empleados
  add column if not exists observaciones_rrhh text;

comment on column public.ci_empleados.observaciones_rrhh is
  'Notas internas de RRHH para seguimiento del expediente del trabajador.';

notify pgrst, 'reload schema';
--