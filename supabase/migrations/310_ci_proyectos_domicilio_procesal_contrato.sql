-- Domicilio procesal del contrato laboral por obra (cláusula DÉCIMA).
-- Antes: «Pampatar» hardcodeado en el PDF / plantilla.

alter table public.ci_proyectos
  add column if not exists domicilio_procesal_contrato text;

comment on column public.ci_proyectos.domicilio_procesal_contrato is
  'Ciudad de domicilio procesal (cláusula DÉCIMA). Default operativo: Pampatar.';

notify pgrst, 'reload schema';
