-- 379b: restaura la condición de ingreso previo por enlace (377). Requiere 379a.

create or replace function public.ci_completar_ingreso_almacen_compra(
  p_purchase_invoice_id uuid,
  p_numero_factura varchar,
  p_proveedor_rif varchar,
  p_proveedor_nombre varchar,
  p_fecha_emision date,
  p_subtotal numeric,
  p_impuesto numeric,
  p_total numeric,
  p_ubicacion_destino_id uuid,
  p_documento_storage_path text default null,
  p_condicion_pago varchar default 'contado',
  p_dias_credito integer default null,
  p_lineas jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pi uuid := p_purchase_invoice_id;
  v_cf record;
  v_cc record;
  v_factura_id uuid;
  v_line jsonb;
  v_material_id uuid;
  v_cantidad numeric;
  v_precio numeric;
  v_desc text;
  v_subtotal numeric;
  v_ingreso_previo boolean := false;
  v_link record;
begin
  if v_pi is null then
    raise exception 'purchase_invoice_id es obligatorio';
  end if;
  if p_ubicacion_destino_id is null then
    raise exception 'ubicacion_destino_id es obligatorio';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Debe indicar al menos una línea de inventario';
  end if;

  select * into v_cc
  from public.contabilidad_compras cc
  where cc.purchase_invoice_id = v_pi
  for update;

  select * into v_cf
  from public.compras_facturas cf
  where cf.purchase_invoice_id = v_pi
  for update;

  if v_cf.id is not null then
    if v_cf.estado = 'registrada' then
      perform public.ci_sincronizar_contabilidad_tras_inventario(v_pi);
      if v_cc.id is not null then
        perform public.ci_vincular_procura_compra(v_pi, null, v_cc.id, true);
      end if;
      return jsonb_build_object(
        'success', true,
        'ya_existia', true,
        'compra_factura_id', v_cf.id
      );
    end if;

    if v_cf.estado = 'borrador' then
      -- CAMBIO 377: el ingreso previo se prueba con el vínculo real, no con el stock del material.
      v_ingreso_previo := v_cc.ingresado_almacen_at is not null;
      if not v_ingreso_previo and v_cc.id is not null then
        select exists (
          select 1
          from public.ci_recepciones_campo r
          where r.contabilidad_compra_id = v_cc.id
            and r.ubicacion_id = p_ubicacion_destino_id
            and r.estado = 'registrado'
        ) into v_ingreso_previo;
      end if;

      if v_ingreso_previo then
        perform public.ci_sincronizar_contabilidad_tras_inventario(v_pi);
        if v_cc.id is not null then
          perform public.ci_vincular_procura_compra(v_pi, null, v_cc.id, true);
        end if;
        return jsonb_build_object(
          'success', true,
          'ya_existia', true,
          'ingreso_fisico_previo', true,
          'compra_factura_id', v_cf.id,
          'aviso', 'Stock ya ingresado en campo; contabilidad sincronizada sin duplicar inventario.'
        );
      end if;

      update public.compras_facturas cf
      set estado = 'registrada', updated_at = now()
      where cf.id = v_cf.id;

      perform public.ci_sincronizar_contabilidad_tras_inventario(v_pi);
      if v_cc.id is not null then
        perform public.ci_vincular_procura_compra(v_pi, null, v_cc.id, true);
      end if;

      return jsonb_build_object(
        'success', true,
        'ya_existia', true,
        'compra_factura_id', v_cf.id
      );
    end if;
  end if;

  v_subtotal := coalesce(p_subtotal, 0);
  if v_subtotal <= 0 then
    select coalesce(sum((x->>'cantidad')::numeric * coalesce((x->>'precio_unitario')::numeric, 0)), 0)
    into v_subtotal
    from jsonb_array_elements(p_lineas) x;
  end if;

  insert into public.compras_facturas (
    numero_factura,
    proveedor_rif,
    proveedor_nombre,
    fecha_emision,
    subtotal,
    impuesto,
    total,
    ubicacion_destino_id,
    estado,
    purchase_invoice_id,
    documento_storage_path,
    condicion_pago,
    dias_credito
  )
  values (
    coalesce(nullif(trim(p_numero_factura), ''), 'S/N'),
    coalesce(nullif(trim(p_proveedor_rif), ''), 'S/R'),
    coalesce(nullif(trim(p_proveedor_nombre), ''), 'Proveedor'),
    coalesce(p_fecha_emision, current_date),
    v_subtotal,
    coalesce(p_impuesto, 0),
    coalesce(p_total, v_subtotal),
    p_ubicacion_destino_id,
    'borrador',
    v_pi,
    nullif(trim(p_documento_storage_path), ''),
    coalesce(nullif(trim(p_condicion_pago), ''), 'contado'),
    case when coalesce(nullif(trim(p_condicion_pago), ''), 'contado') = 'credito'
      then p_dias_credito else null end
  )
  returning id into v_factura_id;

  for v_line in select value from jsonb_array_elements(p_lineas)
  loop
    v_material_id := nullif(trim(v_line->>'material_id'), '')::uuid;
    v_cantidad := (v_line->>'cantidad')::numeric;
    v_precio := coalesce((v_line->>'precio_unitario')::numeric, 0);
    v_desc := coalesce(nullif(trim(v_line->>'descripcion'), ''), 'Ítem');

    if v_material_id is null then
      raise exception 'Cada línea debe incluir material_id válido';
    end if;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida en línea';
    end if;

    insert into public.compras_factura_lineas (
      factura_id,
      material_id,
      descripcion,
      cantidad,
      precio_unitario,
      requiere_serie
    )
    values (
      v_factura_id,
      v_material_id,
      left(v_desc, 500),
      v_cantidad,
      v_precio,
      coalesce((v_line->>'requiere_serie')::boolean, false)
    );
  end loop;

  update public.compras_facturas cf
  set estado = 'registrada', updated_at = now()
  where cf.id = v_factura_id;

  perform public.ci_sincronizar_contabilidad_tras_inventario(v_pi);

  if v_cc.id is not null then
    select * into v_link
    from public.ci_vincular_procura_compra(v_pi, null, v_cc.id, true)
    limit 1;
  end if;

  return jsonb_build_object(
    'success', true,
    'ya_existia', false,
    'compra_factura_id', v_factura_id,
    'procura_id', v_link.procura_id,
    'procura_ticket', v_link.ticket,
    'desviacion_usd', v_link.desviacion_usd
  );

exception
  when unique_violation then
    select cf.id into v_factura_id
    from public.compras_facturas cf
    where cf.purchase_invoice_id = v_pi
    limit 1;

    if v_factura_id is not null then
      perform public.ci_sincronizar_contabilidad_tras_inventario(v_pi);
      if v_cc.id is not null then
        perform public.ci_vincular_procura_compra(v_pi, null, v_cc.id, true);
      end if;
      return jsonb_build_object(
        'success', true,
        'ya_existia', true,
        'compra_factura_id', v_factura_id,
        'concurrencia', true
      );
    end if;
    raise;
end;
$$;

comment on function public.ci_completar_ingreso_almacen_compra is
  'D-07 + 379b: ingreso inventario + sync contabilidad + vínculo procura. Ingreso previo solo por enlace FRM o ingresado_almacen_at.';
