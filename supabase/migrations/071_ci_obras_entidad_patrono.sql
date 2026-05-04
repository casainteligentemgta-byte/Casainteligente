-- Obra Talento: misma noción de patrono que ci_proyectos (planillas, contratos).

alter table public.ci_obras
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

create index if not exists idx_ci_obras_entidad on public.ci_obras (entidad_id);

comment on column public.ci_obras.entidad_id is
  'Patrono / empresa ejecutora (ci_entidades). Distinto del campo texto cliente.';

notify pgrst, 'reload schema';
