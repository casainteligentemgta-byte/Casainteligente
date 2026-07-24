-- Idempotente: columna JSON de hoja de vida obrero si 062 no se aplicó en el proyecto.
-- Corrige: Could not find the 'hoja_vida_obrero' column of 'ci_empleados' in the schema cache.

alter table public.ci_empleados
  add column if not exists hoja_vida_obrero jsonb not null default '{}'::jsonb;

comment on column public.ci_empleados.hoja_vida_obrero is
  'Hoja de vida legal obrero: identificación, contratación, antecedentes, instrucción, gremial, médicos, medidas, dependientes, trabajos previos (estructura app).';

notify pgrst, 'reload schema';
