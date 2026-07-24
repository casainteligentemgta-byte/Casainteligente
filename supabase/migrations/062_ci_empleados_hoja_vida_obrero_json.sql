-- Formulario legal completo de hoja de vida del obrero (JSON).

alter table public.ci_empleados
  add column if not exists hoja_vida_obrero jsonb not null default '{}'::jsonb;

comment on column public.ci_empleados.hoja_vida_obrero is
  'Hoja de vida legal obrero: identificación, contratación, antecedentes, instrucción, gremial, médicos, medidas, dependientes, trabajos previos (estructura app).';
