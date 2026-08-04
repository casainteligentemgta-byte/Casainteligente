-- SQL Editor (producción): domicilio procesal por obra + reload PostgREST.
-- Pegar en Supabase → SQL Editor → Run.

alter table public.ci_proyectos
  add column if not exists domicilio_procesal_contrato text;

comment on column public.ci_proyectos.domicilio_procesal_contrato is
  'Ciudad de domicilio procesal (cláusula DÉCIMA). Default operativo: Pampatar.';

notify pgrst, 'reload schema';
