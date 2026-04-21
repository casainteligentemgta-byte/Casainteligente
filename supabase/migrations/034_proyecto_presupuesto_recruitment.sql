-- Presupuesto del proyecto (VES) y vínculo vacante → obra (proyecto).

alter table public.ci_obras
  add column if not exists presupuesto_ves numeric(14, 2);

comment on column public.ci_obras.presupuesto_ves is
  'Presupuesto total de referencia del proyecto en bolívares (opcional).';

alter table public.recruitment_needs
  add column if not exists proyecto_id uuid references public.ci_obras (id) on delete restrict;

create index if not exists idx_recruitment_needs_proyecto_id on public.recruitment_needs (proyecto_id);

comment on column public.recruitment_needs.proyecto_id is
  'Obra/proyecto al que pertenece la vacante; obligatorio en nuevos registros vía API.';
