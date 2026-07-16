-- D-02: mutex compras_facturas por purchase_invoice_id
-- D-05/D-06: procura_id en contabilidad + desviacion_usd en procura
-- D-07: ingreso almacén + sync contable atómico en Postgres

-- ── D-02 ─────────────────────────────────────────────────────────────────────
create unique index if not exists idx_compras_facturas_purchase_invoice_unique
  on public.compras_facturas (purchase_invoice_id)
  where purchase_invoice_id is not null;

comment on index public.idx_compras_facturas_purchase_invoice_unique is
  'D-02: evita dos facturas logísticas para el mismo purchase_invoice_id (carrera concurrente).';

-- ── D-05 / D-06 columnas ───────────────────────────────────────────────────
alter table public.contabilidad_compras
  add column if not exists procura_id uuid
    references public.ci_procuras (id) on delete set null;

create index if not exists idx_contabilidad_compras_procura
  on public.contabilidad_compras (procura_id)
  where procura_id is not null;

comment on column public.contabilidad_compras.procura_id is
  'D-05: procura origen (PR-*) vinculada a esta compra contable.';

alter table public.ci_procuras
  add column if not exists desviacion_usd numeric(12, 2);

comment on column public.ci_procuras.desviacion_usd is
  'D-06: total real USD − monto_estimado_usd al vincular purchase_invoice_id.';

-- ── D-06: recalcular desviación ────────────────────────────────────────────
create or replace function public.ci_calcular_desviacion_procura_usd(p_procura_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_est numeric;
  v_real numeric;
  v_pi uuid;
begin
  if p_procura_id is null then
    return null;
  end if;

  select p.monto_estimado_usd, p.purchase_invoice_id
  into v_est, v_pi
  from public.ci_procuras p
  where p.id = p_procura_id;

  if not found then
    return null;
  end if;

  if v_pi is null then
    return null;
  end if;

  select coalesce(cc.total_amount_usd, cc.total_amount, 0)
  into v_real
  from public.contabilidad_compras cc
  where cc.purchase_invoice_id = v_pi
  limit 1;

  if v_est is null then
    return round(v_real, 2);
  end if;

  return round(v_real - v_est, 2);
end;
$$;

-- ── D-05: vincular procura ↔ compra contable ───────────────────────────────
create or replace function public.ci_vincular_procura_compra(
  p_purchase_invoice_id uuid,
  p_procura_id uuid default null,
  p_contabilidad_compra_id uuid default null,
  p_auto_match boolean default true
)
returns table (
  procura_id uuid,
  ticket text,
  desviacion_usd numeric,
  vinculado boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pi uuid := p_purchase_invoice_id;
  v_cc record;
  v_procura_id uuid := p_procura_id;
  v_procura public.ci_procuras;
  v_desv numeric;
  v_material uuid;
begin
  if v_pi is null then
    return;
  end if;

  if p_contabilidad_compra_id is not null then
    select * into v_cc
    from public.contabilidad_compras c
    where c.id = p_contabilidad_compra_id
    for update;
  else
    select * into v_cc
    from public.contabilidad_compras c
    where c.purchase_invoice_id = v_pi
    for update;
  end if;

  if not found then
    return;
  end if;

  if v_procura_id is null then
    v_procura_id := v_cc.procura_id;
  end if;

  if v_procura_id is null and p_auto_match then
    select cl.material_id into v_material
    from public.contabilidad_compra_lineas cl
    where cl.compra_id = v_cc.id
      and cl.material_id is not null
    order by cl.created_at
    limit 1;

    select p.id into v_procura_id
    from public.ci_procuras p
    where p.proyecto_id is not distinct from v_cc.proyecto_id
      and p.estado in ('en_compra', 'aprobada', 'aprobada_directa', 'recibida_parcial')
      and (p.purchase_invoice_id is null or p.purchase_invoice_id = v_pi)
      and (
        v_material is null
        or p.material_id is null
        or p.material_id = v_material
      )
    order by
      case when p.purchase_invoice_id = v_pi then 0 else 1 end,
      p.updated_at desc
    limit 1;
  end if;

  if v_procura_id is null then
    return;
  end if;

  select * into v_procura
  from public.ci_procuras p
  where p.id = v_procura_id
  for update;

  if not found then
    return;
  end if;

  if v_procura.purchase_invoice_id is not null and v_procura.purchase_invoice_id <> v_pi then
    return;
  end if;

  update public.ci_procuras p
  set
    purchase_invoice_id = v_pi,
    updated_at = now()
  where p.id = v_procura_id;

  update public.contabilidad_compras c
  set procura_id = v_procura_id
  where c.id = v_cc.id
    and (c.procura_id is null or c.procura_id = v_procura_id);

  v_desv := public.ci_calcular_desviacion_procura_usd(v_procura_id);

  update public.ci_procuras p
  set desviacion_usd = v_desv
  where p.id = v_procura_id;

  procura_id := v_procura_id;
  ticket := v_procura.ticket;
  desviacion_usd := v_desv;
  vinculado := true;
  return next;
end;
$$;

comment on function public.ci_vincular_procura_compra(uuid, uuid, uuid, boolean) is
  'D-05/D-06: enlaza procura↔PI contable, auto-match por proyecto/material, calcula desviacion_usd.';

-- ── Sync contable tras inventario (extraído de Node) ───────────────────────
create or replace function public.ci_sincronizar_contabilidad_tras_inventario(
  p_purchase_invoice_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pi uuid := p_purchase_invoice_id;
  v_cf record;
  v_cc record;
  v_ingresado timestamptz;
begin
  if v_pi is null then
    return null;
  end if;

  select cf.id, cf.registrada_at, cf.updated_at
  into v_cf
  from public.compras_facturas cf
  where cf.purchase_invoice_id = v_pi
  limit 1;

  if v_cf.id is null then
    return null;
  end if;

  v_ingresado := coalesce(v_cf.registrada_at, v_cf.updated_at, now());

  select cc.id, cc.ingresado_almacen_at
  into v_cc
  from public.contabilidad_compras cc
  where cc.purchase_invoice_id = v_pi
  for update;

  if v_cc.id is null then
    return v_cf.id;
  end if;

  update public.contabilidad_compras cc
  set
    compra_factura_id = v_cf.id,
    cuarentena_rechazo_total = false,
    ingresado_almacen_at = coalesce(v_cc.ingresado_almacen_at, v_ingresado)
  where cc.id = v_cc.id;

  return v_cf.id;
end;
$$;

-- ── D-07: ingreso almacén completo (stock trigger + sync contable) ─────────
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
      v_ingreso_previo := v_cc.ingresado_almacen_at is not null;
      if not v_ingreso_previo then
        select exists (
          select 1
          from public.compras_factura_lineas l
          join public.inventario_stock s
            on s.ubicacion_id = p_ubicacion_destino_id
           and s.material_id = l.material_id
           and s.cantidad_disponible > 0
          where l.factura_id = v_cf.id
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
  'D-07: ingreso inventario + sync contabilidad + vínculo procura en una transacción PL/pgSQL.';

revoke execute on function public.ci_vincular_procura_compra(uuid, uuid, uuid, boolean) from public;
revoke execute on function public.ci_vincular_procura_compra(uuid, uuid, uuid, boolean) from anon;
revoke execute on function public.ci_vincular_procura_compra(uuid, uuid, uuid, boolean) from authenticated;
grant execute on function public.ci_vincular_procura_compra(uuid, uuid, uuid, boolean) to service_role;

revoke execute on function public.ci_sincronizar_contabilidad_tras_inventario(uuid) from public;
revoke execute on function public.ci_sincronizar_contabilidad_tras_inventario(uuid) from anon;
revoke execute on function public.ci_sincronizar_contabilidad_tras_inventario(uuid) from authenticated;
grant execute on function public.ci_sincronizar_contabilidad_tras_inventario(uuid) to service_role;

revoke execute on function public.ci_completar_ingreso_almacen_compra from public;
revoke execute on function public.ci_completar_ingreso_almacen_compra from anon;
revoke execute on function public.ci_completar_ingreso_almacen_compra from authenticated;
grant execute on function public.ci_completar_ingreso_almacen_compra to service_role;

notify pgrst, 'reload schema';
