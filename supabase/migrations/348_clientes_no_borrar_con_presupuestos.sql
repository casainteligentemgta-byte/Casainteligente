-- Un cliente con presupuestos no se borra.
--
-- Antes, al eliminar un cliente sus presupuestos quedaban sin cliente (la relación
-- los dejaba con customer_id vacío): seguían en la lista de Presupuestos, pero ya no
-- aparecían en ninguna ficha ni contaban para nadie.
--
-- La pantalla /clientes ya lo impide y explica el motivo. Este disparador lo garantiza
-- también en la base, venga la orden de donde venga. Los clientes con obras ya estaban
-- protegidos por la relación con ci_proyectos.
--
-- Solo agrega una función y un disparador; no cambia datos. Idempotente.

create or replace function public.customers_no_borrar_con_presupuestos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  select count(*) into n from public.budgets b where b.customer_id = old.id;
  if n > 0 then
    raise exception 'No se puede eliminar: este cliente tiene % presupuesto(s). Sus documentos quedarían sin cliente.', n
      using errcode = '23503';
  end if;
  return old;
end
$$;

comment on function public.customers_no_borrar_con_presupuestos() is
  'Impide eliminar un cliente que tiene presupuestos.';

create or replace trigger customers_no_borrar_con_presupuestos
  before delete on public.customers
  for each row execute function public.customers_no_borrar_con_presupuestos();
