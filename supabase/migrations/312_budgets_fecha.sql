-- Fecha de documento del presupuesto (editable al crear/editar). Independiente de created_at.

alter table public.budgets
  add column if not exists fecha date;

update public.budgets
set fecha = (created_at at time zone 'America/Caracas')::date
where fecha is null and created_at is not null;

alter table public.budgets
  alter column fecha set default ((now() at time zone 'America/Caracas')::date);

comment on column public.budgets.fecha is
  'Fecha impresa del presupuesto (día en Venezuela). Se puede cambiar al editar; created_at sigue siendo el alta del registro.';

create index if not exists idx_budgets_fecha
  on public.budgets (fecha desc);

notify pgrst, 'reload schema';
