-- Bono no salarial (USD) por obrero asignado a una solicitud de personal.

alter table public.project_assignments
  add column if not exists bono_usd numeric(14, 2) not null default 0
    check (bono_usd >= 0);

comment on column public.project_assignments.bono_usd is
  'Bono manual complementario en USD para este obrero en la solicitud (cláusula SEXTA / express).';

notify pgrst, 'reload schema';
