-- Al registrar compras_facturas: mover cantidad de tránsito entrante a disponible (no sumar disponible directo).

create or replace function public.inv_compra_registrar_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ubicacion uuid;
  r record;
begin
  if new.estado = 'registrada' and (old.estado is distinct from 'registrada') then
    v_ubicacion := new.ubicacion_destino_id;
    for r in
      select material_id, sum(cantidad) as qty
      from public.compras_factura_lineas
      where factura_id = new.id
      group by material_id
    loop
      perform public.inv_stock_apply_delta(v_ubicacion, r.material_id, r.qty, 0, -r.qty);
    end loop;
    new.registrada_at := coalesce(new.registrada_at, now());
  end if;
  return new;
end;
$$;

comment on function public.inv_compra_registrar_stock is
  'Registro compra: incrementa disponible y descuenta tránsito entrante (recepción física).';

notify pgrst, 'reload schema';
