-- Presupuestos adicionales vinculados al proyecto (además de budget_id principal).

alter table public.ci_proyectos
  add column if not exists budgets_adicionales jsonb not null default '[]'::jsonb;

comment on column public.ci_proyectos.budgets_adicionales is
  'Array JSON de UUID (texto) referenciando public.budgets.id, mismo criterio que budget_id.';

notify pgrst, 'reload schema';
