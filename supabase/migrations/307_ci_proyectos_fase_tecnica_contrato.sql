-- Fase técnica de la obra (cláusula PRIMERA del contrato laboral obrero).
-- La completa el PM una vez por obra; RRHH la reutiliza al generar contratos.

alter table public.ci_proyectos
  add column if not exists fase_tecnica_contrato text;

comment on column public.ci_proyectos.fase_tecnica_contrato is
  'Fase técnica / objeto de obra determinada (cláusula PRIMERA del contrato individual). Completa el PM una vez por proyecto; se usa si el contrato no trae objeto_contrato propio.';
