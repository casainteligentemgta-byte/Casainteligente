-- Presupuestos: updated_at automático al modificar; número correlativo inmutable desde la app.
-- created_at ya existe (alta). updated_at se refresca en cada UPDATE (también vía abonos/RPC).

begin;

create or replace function public.budgets_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  -- El número correlativo no se cambia una vez asignado.
  if tg_op = 'UPDATE'
     and old.numero_correlativo is not null
     and new.numero_correlativo is distinct from old.numero_correlativo then
    new.numero_correlativo := old.numero_correlativo;
  end if;
  -- created_at tampoco se reescribe.
  if tg_op = 'UPDATE' and old.created_at is not null then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_budgets_touch_updated_at on public.budgets;
create trigger trg_budgets_touch_updated_at
  before update on public.budgets
  for each row
  execute function public.budgets_touch_updated_at();

comment on column public.budgets.created_at is 'Fecha/hora de creación del presupuesto (fija).';
comment on column public.budgets.updated_at is 'Fecha/hora de la última modificación (automática).';
comment on column public.budgets.numero_correlativo is 'Número fijo P-N; no editable tras asignarse.';

commit;
