-- Recepción física por depositario (sin exponer precios).
-- Alineado a: compras_facturas, compras_factura_lineas, global_inventory, inventario_stock + inv_stock_apply_delta.

-- 1. Estado de recepción física (no reemplaza estado contable borrador/registrada/anulada)
alter table public.compras_facturas
  add column if not exists estado_recepcion_fisica text not null default 'por_verificar';

alter table public.compras_facturas
  drop constraint if exists compras_facturas_estado_recepcion_fisica_check;

alter table public.compras_facturas
  add constraint compras_facturas_estado_recepcion_fisica_check
  check (
    estado_recepcion_fisica in (
      'por_verificar',
      'ingresada_almacen',
      'discrepancia'
    )
  );

comment on column public.compras_facturas.estado_recepcion_fisica is
  'Conteo físico depositario: por_verificar → ingresada_almacen | discrepancia.';

create index if not exists idx_compras_facturas_estado_recepcion_fisica
  on public.compras_facturas (estado_recepcion_fisica);

-- 2. Líneas sin precios (SECURITY DEFINER, columnas mínimas)
create or replace function public.obtener_lineas_para_depositario(p_factura_id uuid)
returns table (
  linea_id uuid,
  material_id uuid,
  material_nombre text,
  material_codigo text,
  cantidad_facturada numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.compras_facturas f where f.id = p_factura_id) then
    raise exception 'Factura de compra no encontrada: %', p_factura_id;
  end if;

  return query
  select
    l.id as linea_id,
    l.material_id,
    coalesce(nullif(btrim(g.name), ''), nullif(btrim(l.descripcion), ''), 'Material') as material_nombre,
    coalesce(nullif(btrim(g.sku), ''), '') as material_codigo,
    l.cantidad as cantidad_facturada
  from public.compras_factura_lineas l
  join public.global_inventory g on g.id = l.material_id
  where l.factura_id = p_factura_id
  order by l.created_at, l.id;
end;
$$;

comment on function public.obtener_lineas_para_depositario(uuid) is
  'Depositario/Telegram: líneas de compra sin precio_unitario ni totales.';

revoke all on function public.obtener_lineas_para_depositario(uuid) from public;
grant execute on function public.obtener_lineas_para_depositario(uuid) to authenticated, service_role;

-- 3. Ingreso físico transaccional (JSON: [{"material_id":"uuid","cantidad_real":50}])
create or replace function public.ingresar_mercancia_almacen(
  p_factura_id uuid,
  p_usuario_telegram_id text,
  p_items_recibidos jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ubicacion_id uuid;
  v_estado_contable text;
  v_item record;
  v_cantidad_facturada numeric;
  v_hubo_discrepancia boolean := false;
  v_aplicar_stock boolean;
begin
  if p_items_recibidos is null or jsonb_typeof(p_items_recibidos) <> 'array' then
    raise exception 'p_items_recibidos debe ser un arreglo JSON';
  end if;

  select f.ubicacion_destino_id, f.estado
  into v_ubicacion_id, v_estado_contable
  from public.compras_facturas f
  where f.id = p_factura_id;

  if v_ubicacion_id is null then
    raise exception 'Factura sin ubicacion_destino_id';
  end if;

  -- Si ya pasó a registrada, el trigger inv_compra_registrar_stock ya sumó stock facturado.
  v_aplicar_stock := (v_estado_contable is distinct from 'registrada');

  for v_item in
    select *
    from jsonb_to_recordset(p_items_recibidos) as x(
      material_id uuid,
      cantidad_real numeric
    )
  loop
    if v_item.material_id is null or coalesce(v_item.cantidad_real, 0) <= 0 then
      continue;
    end if;

    select l.cantidad
    into v_cantidad_facturada
    from public.compras_factura_lineas l
    where l.factura_id = p_factura_id
      and l.material_id = v_item.material_id
    limit 1;

    if v_cantidad_facturada is null then
      v_hubo_discrepancia := true;
    elsif v_cantidad_facturada <> v_item.cantidad_real then
      v_hubo_discrepancia := true;
    end if;

    if v_aplicar_stock then
      perform public.inv_stock_apply_delta(
        v_ubicacion_id,
        v_item.material_id,
        v_item.cantidad_real,
        0,
        0
      );
    end if;
  end loop;

  update public.compras_facturas
  set
    estado_recepcion_fisica = case
      when v_hubo_discrepancia then 'discrepancia'
      else 'ingresada_almacen'
    end,
    updated_at = now()
  where id = p_factura_id;

  return true;
end;
$$;

comment on function public.ingresar_mercancia_almacen(uuid, text, jsonb) is
  'Depositario: cuenta física vs compras_factura_lineas; stock vía inv_stock_apply_delta si la factura aún no está registrada.';

revoke all on function public.ingresar_mercancia_almacen(uuid, text, jsonb) from public;
grant execute on function public.ingresar_mercancia_almacen(uuid, text, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
