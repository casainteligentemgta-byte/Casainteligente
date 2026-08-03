-- Ejecutar en SQL Editor si la migración 307 aún no está aplicada en el entorno.
-- Fase técnica de obra para contratos laborales (PM → una vez por proyecto).

alter table public.ci_proyectos
  add column if not exists fase_tecnica_contrato text;

comment on column public.ci_proyectos.fase_tecnica_contrato is
  'Fase técnica / objeto de obra determinada (cláusula PRIMERA del contrato individual). Completa el PM una vez por proyecto; se usa si el contrato no trae objeto_contrato propio.';

notify pgrst, 'reload schema';
