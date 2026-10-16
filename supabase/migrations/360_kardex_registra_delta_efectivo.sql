-- 360 · Kardex = stock.
--
-- inv_stock_apply_delta recorta el stock en 0 (greatest(0, …)) pero anotaba en
-- inv_movimientos el delta pedido completo. Cuando una anulación o ajuste restaba más de
-- lo que había, el stock quedaba en 0 y el kardex en negativo: descuadres permanentes.
--
-- Ahora se calcula primero el saldo nuevo y se registra en el kardex el delta efectivo
-- (lo que realmente cambió). Si hubo recorte, queda anotado en las notas del movimiento.
-- Misma firma: los permisos (sólo service_role, migración 356) se conservan.

create or replace function public.inv_stock_apply_delta(
  p_ubicacion_id uuid,
  p_material_id uuid,
  p_delta_disponible numeric default 0,
  p_delta_reservada numeric default 0,
  p_delta_transito_entrante numeric default 0,
  p_tipo_movimiento text default 'ajuste',
  p_referencia_tipo text default null,
  p_referencia_id uuid default null,
  p_documento_id uuid default null,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tipo text;
  v_disp numeric;
  v_res numeric;
  v_tr numeric;
  v_ef_disp numeric;
  v_ef_res numeric;
  v_ef_tr numeric;
  v_notas text;
begin
  v_tipo := coalesce(nullif(btrim(p_tipo_movimiento), ''), 'ajuste');
  if v_tipo not in (
    'ingreso_compra', 'transferencia_salida', 'transferencia_entrada',
    'recepcion_campo', 'salida_obra', 'ajuste', 'anulacion'
  ) then
    v_tipo := 'ajuste';
  end if;

  insert into public.inventario_stock (ubicacion_id, material_id)
  values (p_ubicacion_id, p_material_id)
  on conflict (ubicacion_id, material_id) do nothing;

  select s.cantidad_disponible, s.cantidad_reservada, s.cantidad_en_transito_entrante
    into v_disp, v_res, v_tr
  from public.inventario_stock s
  where s.ubicacion_id = p_ubicacion_id and s.material_id = p_material_id
  for update;

  if not found then
    raise exception 'No se pudo actualizar stock para ubicación % material %', p_ubicacion_id, p_material_id;
  end if;

  v_ef_disp := greatest(0, v_disp + coalesce(p_delta_disponible, 0)) - v_disp;
  v_ef_res := greatest(0, v_res + coalesce(p_delta_reservada, 0)) - v_res;
  v_ef_tr := greatest(0, v_tr + coalesce(p_delta_transito_entrante, 0)) - v_tr;

  update public.inventario_stock s
  set
    cantidad_disponible = v_disp + v_ef_disp,
    cantidad_reservada = v_res + v_ef_res,
    cantidad_en_transito_entrante = v_tr + v_ef_tr,
    updated_at = now()
  where s.ubicacion_id = p_ubicacion_id and s.material_id = p_material_id;

  -- Se anota aunque el recorte deje el efecto en 0: así queda rastro del intento.
  if coalesce(p_delta_disponible, 0) <> 0
     or coalesce(p_delta_reservada, 0) <> 0
     or coalesce(p_delta_transito_entrante, 0) <> 0 then
    v_notas := nullif(btrim(p_notas), '');
    if v_ef_disp <> coalesce(p_delta_disponible, 0)
       or v_ef_res <> coalesce(p_delta_reservada, 0)
       or v_ef_tr <> coalesce(p_delta_transito_entrante, 0) then
      v_notas := concat_ws(' · ', v_notas, format(
        'Recortado a 0: pedido disp %s / res %s / tránsito %s',
        coalesce(p_delta_disponible, 0), coalesce(p_delta_reservada, 0),
        coalesce(p_delta_transito_entrante, 0)
      ));
    end if;

    insert into public.inv_movimientos (
      ubicacion_id, material_id,
      delta_disponible, delta_reservada, delta_transito_entrante,
      tipo_movimiento, referencia_tipo, referencia_id, documento_id, notas
    ) values (
      p_ubicacion_id, p_material_id,
      v_ef_disp, v_ef_res, v_ef_tr,
      v_tipo, nullif(btrim(p_referencia_tipo), ''), p_referencia_id, p_documento_id, v_notas
    );
  end if;
end;
$function$;

-- Cuadre de los descuadres que dejó la versión anterior: un movimiento «ajuste» por la
-- diferencia entre el stock (la verdad: nunca bajó de 0) y la suma del kardex.
-- No borra nada; sólo agrega la línea compensatoria.
insert into public.inv_movimientos (
  ubicacion_id, material_id,
  delta_disponible, delta_reservada, delta_transito_entrante,
  tipo_movimiento, referencia_tipo, notas
)
select
  s.ubicacion_id, s.material_id,
  s.cantidad_disponible - coalesce(k.kd, 0),
  s.cantidad_reservada - coalesce(k.kr, 0),
  s.cantidad_en_transito_entrante - coalesce(k.kt, 0),
  'ajuste', 'cuadre_kardex_360',
  'Cuadre kardex ↔ stock (migración 360): el kardex anotaba salidas mayores al stock existente'
from public.inventario_stock s
left join (
  select ubicacion_id, material_id,
    sum(delta_disponible) kd, sum(delta_reservada) kr, sum(delta_transito_entrante) kt
  from public.inv_movimientos
  group by 1, 2
) k using (ubicacion_id, material_id)
where s.cantidad_disponible <> coalesce(k.kd, 0)
   or s.cantidad_reservada <> coalesce(k.kr, 0)
   or s.cantidad_en_transito_entrante <> coalesce(k.kt, 0);
