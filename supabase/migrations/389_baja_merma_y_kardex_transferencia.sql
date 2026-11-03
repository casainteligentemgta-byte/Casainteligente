-- 389 · Baja / merma en kardex + trigger de transferencias con firma de 10 parámetros.
--
-- 1) inv_movimientos admite tipo «baja» (deterioro, vencido, perdido, robo).
-- 2) El trigger de transferencias llamaba inv_stock_apply_delta con 5 argumentos
--    (firma de la migr. 180). Tras 204/360 solo queda la de 10 parámetros: en Postgres
--    los defaults cubren la llamada, pero el kardex quedaba como «ajuste» sin referencia.
--    Ahora anota transferencia_salida / transferencia_entrada / baja y apunta a
--    transferencias_inventario, para que /salida y traspaso dejen rastro.

alter table public.inv_movimientos
  drop constraint if exists inv_movimientos_tipo_movimiento_check;

alter table public.inv_movimientos
  add constraint inv_movimientos_tipo_movimiento_check
  check (
    tipo_movimiento in (
      'ingreso_compra',
      'transferencia_salida',
      'transferencia_entrada',
      'recepcion_campo',
      'salida_obra',
      'ajuste',
      'anulacion',
      'baja'
    )
  );

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
    'recepcion_campo', 'salida_obra', 'ajuste', 'anulacion', 'baja'
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

create or replace function public.inv_transferencia_estado_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_tipo_salida text;
  v_tipo_entrada text;
  v_notas text;
begin
  if old.estado = new.estado then
    return new;
  end if;

  v_notas := nullif(btrim(coalesce(new.observaciones, '')), '');
  v_tipo_salida := case
    when new.tipo_movimiento = 'retorno_merma' then 'baja'
    when new.tipo_movimiento = 'salida_obra' then 'salida_obra'
    else 'transferencia_salida'
  end;
  v_tipo_entrada := case
    when new.tipo_movimiento = 'retorno_merma' then 'baja'
    when new.tipo_movimiento = 'salida_obra' then 'salida_obra'
    else 'transferencia_entrada'
  end;

  if new.estado = 'en_transito' and old.estado = 'pendiente' then
    new.despachado_at := coalesce(new.despachado_at, now());
    for r in
      select material_id, sum(cantidad) as qty
      from public.transferencias_inventario_lineas
      where transferencia_id = new.id
      group by material_id
    loop
      perform public.inv_stock_apply_delta(
        new.origen_ubicacion_id, r.material_id, -r.qty, 0, 0,
        v_tipo_salida, 'transferencias_inventario', new.id, null, v_notas
      );
    end loop;
  elsif new.estado = 'completado' and old.estado = 'en_transito' then
    new.recibido_at := coalesce(new.recibido_at, now());
    for r in
      select material_id, sum(cantidad) as qty
      from public.transferencias_inventario_lineas
      where transferencia_id = new.id
      group by material_id
    loop
      perform public.inv_stock_apply_delta(
        new.destino_ubicacion_id, r.material_id, r.qty, 0, 0,
        v_tipo_entrada, 'transferencias_inventario', new.id, null, v_notas
      );
    end loop;
    update public.series_productos sp
    set
      ubicacion_id = new.destino_ubicacion_id,
      estado = case
        when u.tipo = 'obra' then 'en_obra'
        when u.tipo = 'garantias' then 'garantia'
        when new.tipo_movimiento = 'retorno_merma' then 'baja'
        else 'en_stock'
      end,
      ci_proyecto_id = coalesce(new.ci_proyecto_id, u.ci_proyecto_id),
      updated_at = now()
    from public.transferencias_inventario_lineas tl
    join public.inv_ubicaciones u on u.id = new.destino_ubicacion_id
    where tl.transferencia_id = new.id
      and sp.id = tl.serie_id;
  elsif new.estado = 'rechazado' and old.estado = 'en_transito' then
    for r in
      select material_id, sum(cantidad) as qty
      from public.transferencias_inventario_lineas
      where transferencia_id = new.id
      group by material_id
    loop
      perform public.inv_stock_apply_delta(
        new.origen_ubicacion_id, r.material_id, r.qty, 0, 0,
        'ajuste', 'transferencias_inventario', new.id, null,
        concat_ws(' · ', v_notas, 'Reverso de despacho rechazado')
      );
    end loop;
  end if;

  return new;
end;
$$;

comment on function public.inv_transferencia_estado_stock() is
  'Al cambiar estado de transferencia aplica stock y kardex (salida/entrada/baja) vía inv_stock_apply_delta de 10 parámetros.';

-- CREATE OR REPLACE conserva GRANT de migr. 356 (sólo service_role).
-- Idempotencia del conteo Telegram /ingreso (factura precargada → ci_recepciones_campo).
create unique index if not exists uq_ci_recepciones_campo_factura_canal
  on public.ci_recepciones_campo (factura_canal_pendiente_id)
  where factura_canal_pendiente_id is not null and estado is distinct from 'anulado';

notify pgrst, 'reload schema';
