-- Override presupuestario + vínculo opcional a proyecto módulo integral (ci_proyectos).

alter table public.recruitment_needs
  add column if not exists alerta_presupuesto_ignorada boolean not null default false;

alter table public.recruitment_needs
  add column if not exists notas_autorizacion text;

alter table public.recruitment_needs
  add column if not exists proyecto_modulo_id uuid references public.ci_proyectos (id) on delete set null;

create index if not exists idx_recruitment_needs_proyecto_modulo_id on public.recruitment_needs (proyecto_modulo_id);

comment on column public.recruitment_needs.alerta_presupuesto_ignorada is
  'True si el usuario autorizó la vacante pese a alerta de presupuesto.';
comment on column public.recruitment_needs.notas_autorizacion is
  'Texto de auditoría al usar override presupuestario.';
comment on column public.recruitment_needs.proyecto_modulo_id is
  'Proyecto módulo integral (ci_proyectos); alternativa o complemento a proyecto_id (ci_obras).';

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
