-- Gasto inmediato (Consumibles / Logística de Campo, Servicios): contabilidad sí, stock no.

create or replace function public.inv_material_es_gasto_inmediato(p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    lower(trim(mc.name)) in (
      lower('Consumibles / Logística de Campo'),
      lower('Servicios')
    ),
    false
  )
  from public.global_inventory g
  left join public.material_categories mc on mc.id = g.category_id
  where g.id = p_material_id;
$$;

comment on function public.inv_material_es_gasto_inmediato(uuid) is
  'True si el SKU es consumible de campo o servicio: no debe sumar inventario_stock al registrar compra.';

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
      select l.material_id, sum(l.cantidad) as qty
      from public.compras_factura_lineas l
      where l.factura_id = new.id
        and not public.inv_material_es_gasto_inmediato(l.material_id)
      group by l.material_id
    loop
      perform public.inv_stock_apply_delta(v_ubicacion, r.material_id, r.qty, 0, -r.qty);
    end loop;
    new.registrada_at := coalesce(new.registrada_at, now());
  end if;
  return new;
end;
$$;

comment on function public.inv_compra_registrar_stock is
  'Registro compra: disponible + descuenta tránsito; omite consumibles de campo y servicios (gasto inmediato).';

notify pgrst, 'reload schema';
