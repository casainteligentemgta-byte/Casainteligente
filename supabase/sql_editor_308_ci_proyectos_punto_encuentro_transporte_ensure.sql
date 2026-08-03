-- Ejecutar en Supabase SQL Editor si aparece:
-- Could not find the 'punto_encuentro_transporte_contrato' column of 'ci_proyectos' in the schema cache
--
-- Idempotente: safe to re-run.

alter table public.ci_proyectos
  add column if not exists horario_semanal_obra_default text;

alter table public.ci_proyectos
  add column if not exists punto_encuentro_transporte_contrato text;

alter table public.ci_proyectos
  add column if not exists fase_tecnica_contrato text;

comment on column public.ci_proyectos.horario_semanal_obra_default is
  'Horario semanal por defecto de la obra (PDF contrato); migr. 115/124.';

comment on column public.ci_proyectos.punto_encuentro_transporte_contrato is
  'Punto de encuentro transporte (cláusula SEXTA PDF contrato); migr. 117/124.';

comment on column public.ci_proyectos.fase_tecnica_contrato is
  'Fase técnica / objeto de obra (cláusula PRIMERA); migr. 307.';

notify pgrst, 'reload schema';
