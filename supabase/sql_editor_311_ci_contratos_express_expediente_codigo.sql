-- SQL Editor (prod): código de expediente estable en contratos express.
-- Pegar en Supabase → SQL Editor si la migración 311 aún no está aplicada.

alter table public.ci_contratos_express
  add column if not exists expediente_codigo text;

comment on column public.ci_contratos_express.expediente_codigo is
  'Código legible del contrato: YYYY-MM-{ENTIDAD}-{OBRA}-{NN}. Se asigna al crear y no cambia al regenerar el PDF.';

create index if not exists idx_ci_contratos_express_expediente_codigo
  on public.ci_contratos_express (expediente_codigo)
  where expediente_codigo is not null;

notify pgrst, 'reload schema';
