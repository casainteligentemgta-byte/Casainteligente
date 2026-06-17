-- Conciliación atómica FRM ↔ factura canal (validaciones + actualización sin duplicar stock).

-- ── Helpers ───────────────────────────────────────────────────────────────────

create or replace function public.ci_frm_moneda_confirmada(p_moneda text)
returns boolean
language sql
immutable
as $$
  select upper(trim(coalesce(p_moneda, ''))) in ('USD', 'VES', 'BS');
$$;

create or replace function public.ci_frm_normalizar_moneda(p_moneda text)
returns text
language sql
immutable
as $$
  select case when upper(trim(coalesce(p_moneda, 'VES'))) = 'USD' then 'USD' else 'VES' end;
$$;

create or replace function public.ci_norm_sku_codigo(p_codigo text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g'), '^SAP-?', '', 'i'));
$$;

create or replace function public.ci_tasa_bcv_compra_fallback()
returns numeric
language sql
stable
as $$
  select coalesce(
    (select c.tasa_bcv_ves_por_usd
       from public.ci_config_nomina c
      where upper(trim(c.cargo_codigo)) = 'GLOBAL'
        and c.tasa_bcv_ves_por_usd > 0
      limit 1),
    36.5
  );
$$;

create or replace function public.ci_calc_montos_compra_bimonetario(
  p_monto_total numeric,
  p_moneda text,
  p_tasa numeric default null
)
returns table (
  monto_ves numeric,
  monto_usd numeric,
  tasa_aplicada numeric,
  moneda_original text,
  total_amount_legacy numeric
)
language plpgsql
stable
as $$
declare
  v_monto numeric := coalesce(p_monto_total, 0);
  v_moneda text := public.ci_frm_normalizar_moneda(p_moneda);
  v_tasa numeric := coalesce(nullif(p_tasa, 0), public.ci_tasa_bcv_compra_fallback());
begin
  if v_monto is null or v_monto < 0 then
    monto_ves := 0;
    monto_usd := 0;
    tasa_aplicada := v_tasa;
    moneda_original := v_moneda;
    total_amount_legacy := 0;
    return next;
    return;
  end if;

  tasa_aplicada := v_tasa;
  moneda_original := v_moneda;

  if v_moneda = 'USD' then
    monto_usd := round(v_monto, 2);
    monto_ves := round(v_monto * v_tasa, 2);
  else
    monto_ves := round(v_monto, 2);
    monto_usd := round(v_monto / nullif(v_tasa, 0), 2);
  end if;

  total_amount_legacy := monto_ves;
  return next;
end;
$$;

create or replace function public.ci_resolver_material_compra_sku(
  p_item_code text,
  p_entidad_id uuid
)
returns uuid
language plpgsql
stable
as $$
declare
  v_norm text := public.ci_norm_sku_codigo(p_item_code);
  v_material uuid;
begin
  if v_norm = '' then
    return null;
  end if;

  select g.id into v_material
    from public.global_inventory g
   where public.ci_norm_sku_codigo(g.sap_code) = v_norm
     and (p_entidad_id is null or g.entidad_id = p_entidad_id)
   limit 1;

  if v_material is not null then
    return v_material;
  end if;

  if p_entidad_id is not null then
    select a.material_id into v_material
      from public.ci_material_aliases a
     where a.entidad_id = p_entidad_id
       and a.alias_norm = v_norm
     limit 1;
  end if;

  return v_material;
end;
$$;

-- ── RPC principal ─────────────────────────────────────────────────────────────

create or replace function public.ci_conciliar_frm_con_factura_canal(
  p_recepcion_campo_id uuid,
  p_factura_canal_id uuid,
  p_extracted_override jsonb default null,
  p_nro_factura_fiscal text default null,
  p_monto_usd numeric default null,
  p_monto_ves numeric default null,
  p_compra_provisional_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recepcion record;
  v_pendiente record;
  v_extracted jsonb;
  v_entidad_id uuid;
  v_compra_id uuid;
  v_purchase_invoice_id uuid;
  v_actualizo_provisional boolean := false;
  v_ya_existia boolean := false;
  v_nota text;
  v_obs text;
  v_fecha date;
  v_invoice_number text;
  v_supplier_name text;
  v_supplier_rif text;
  v_moneda text;
  v_total_lineas numeric := 0;
  v_total_manual numeric;
  v_montos record;
  v_item jsonb;
  v_desc text;
  v_codigo text;
  v_cantidad numeric;
  v_precio numeric;
  v_material_id uuid;
  v_lineas_ok int := 0;
  v_cf_id uuid;
begin
  if p_recepcion_campo_id is null or p_factura_canal_id is null then
    return jsonb_build_object('success', false, 'error', 'Factura y recepción de campo son obligatorias.');
  end if;

  select *
    into v_recepcion
    from public.ci_recepciones_campo r
   where r.id = p_recepcion_campo_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Recepción de campo no encontrada.');
  end if;

  if v_recepcion.estado is distinct from 'registrado' then
    return jsonb_build_object('success', false, 'error', 'La recepción de campo no está activa para conciliar.');
  end if;

  if v_recepcion.factura_canal_pendiente_id is not null then
    return jsonb_build_object('success', false, 'error', 'Esta recepción ya fue conciliada con otra factura.');
  end if;

  if v_recepcion.tipo not in ('nota_entrega', 'emergencia') then
    return jsonb_build_object('success', false, 'error', 'Solo se concilian ingresos manuales (nota o emergencia).');
  end if;

  if v_recepcion.proyecto_id is null or v_recepcion.ubicacion_id is null then
    return jsonb_build_object('success', false, 'error', 'La recepción no tiene proyecto o ubicación válidos.');
  end if;

  select *
    into v_pendiente
    from public.ci_facturas_canal_pendientes f
   where f.id = p_factura_canal_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Factura pendiente no encontrada.');
  end if;

  v_extracted := coalesce(p_extracted_override, v_pendiente.extracted, '{}'::jsonb);

  if p_nro_factura_fiscal is not null and trim(p_nro_factura_fiscal) <> '' then
    v_extracted := jsonb_set(v_extracted, '{invoice_number}', to_jsonb(trim(p_nro_factura_fiscal)), true);
  end if;

  if coalesce(trim(v_extracted->>'supplier_name'), '') = ''
     and coalesce(trim(v_extracted->>'invoice_number'), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Sin datos fiscales en la factura. Edite o reenvíe el documento.');
  end if;

  if not public.ci_frm_moneda_confirmada(v_extracted->>'moneda') then
    return jsonb_build_object('success', false, 'error', 'Indique si la factura está en bolívares (Bs) o dólares (USD).');
  end if;

  v_entidad_id := coalesce(
    v_pendiente.entidad_id,
    (select p.entidad_id from public.ci_proyectos p where p.id = v_recepcion.proyecto_id limit 1)
  );

  v_compra_id := coalesce(p_compra_provisional_id, v_recepcion.contabilidad_compra_id);

  if p_compra_provisional_id is not null
     and v_recepcion.contabilidad_compra_id is not null
     and p_compra_provisional_id is distinct from v_recepcion.contabilidad_compra_id then
    return jsonb_build_object('success', false, 'error', 'La compra provisional no coincide con el FRM enlazado.');
  end if;

  v_fecha := coalesce(nullif(left(trim(v_extracted->>'date'), 10), '')::date, current_date);
  v_invoice_number := left(coalesce(nullif(trim(v_extracted->>'invoice_number'), ''), 'S/N'), 80);
  v_supplier_name := left(coalesce(nullif(trim(v_extracted->>'supplier_name'), ''), 'Proveedor'), 200);
  v_supplier_rif := left(coalesce(nullif(trim(v_extracted->>'supplier_rif'), ''), 'S/R'), 32);
  v_moneda := public.ci_frm_normalizar_moneda(v_extracted->>'moneda');

  -- Validar líneas del extracted
  if jsonb_typeof(v_extracted->'items') <> 'array'
     or jsonb_array_length(v_extracted->'items') = 0 then
    return jsonb_build_object('success', false, 'error', 'La factura fiscal no tiene líneas válidas.');
  end if;

  for v_item in select value from jsonb_array_elements(v_extracted->'items') loop
    v_desc := trim(coalesce(v_item->>'description', ''));
    if v_desc = '' then
      continue;
    end if;
    v_codigo := coalesce(v_item->>'item_code', '');
    v_material_id := public.ci_resolver_material_compra_sku(v_codigo, v_entidad_id);
    if v_material_id is null then
      return jsonb_build_object(
        'success', false,
        'error', 'No se pudo vincular la línea «' || left(v_desc, 120) ||
          '» al catálogo. Revise códigos SAP o alias de material.'
      );
    end if;
    v_cantidad := greatest(coalesce((v_item->>'quantity')::numeric, 1), 0.0001);
    v_precio := greatest(coalesce((v_item->>'unit_price')::numeric, 0), 0);
    v_total_lineas := v_total_lineas + (v_cantidad * v_precio);
    v_lineas_ok := v_lineas_ok + 1;
  end loop;

  if v_lineas_ok = 0 then
    return jsonb_build_object('success', false, 'error', 'La factura fiscal no tiene líneas válidas.');
  end if;

  v_total_manual := coalesce(
    case
      when p_monto_usd is not null and v_moneda = 'USD' then p_monto_usd
      when p_monto_ves is not null and v_moneda = 'VES' then p_monto_ves
      when (v_extracted->>'total_amount')::numeric > 0 then (v_extracted->>'total_amount')::numeric
      else v_total_lineas
    end,
    v_total_lineas
  );

  select * into v_montos
    from public.ci_calc_montos_compra_bimonetario(v_total_manual, v_moneda, null);

  -- ── Ruta provisional (compra ya creada al ingresar FRM) ─────────────────
  if v_compra_id is not null then
    select c.id, c.purchase_invoice_id
      into v_compra_id, v_purchase_invoice_id
      from public.contabilidad_compras c
     where c.id = v_compra_id;

    if v_compra_id is null or v_purchase_invoice_id is null then
      return jsonb_build_object('success', false, 'error', 'La compra provisional del FRM no está enlazada correctamente.');
    end if;

    update public.purchase_invoices pi
       set invoice_number = v_invoice_number,
           supplier_name = v_supplier_name,
           supplier_rif = v_supplier_rif,
           date = v_fecha,
           status = 'REGISTRADA',
           proyecto_id = v_recepcion.proyecto_id,
           ubicacion_destino_id = v_recepcion.ubicacion_id,
           entidad_id = coalesce(v_entidad_id, pi.entidad_id),
           moneda = v_montos.moneda_original,
           moneda_original = v_montos.moneda_original,
           total_amount = v_montos.total_amount_legacy,
           monto_ves = v_montos.monto_ves,
           monto_usd = v_montos.monto_usd,
           tasa_bcv_ves_por_usd = v_montos.tasa_aplicada,
           total_amount_usd = v_montos.monto_usd,
           document_storage_path = coalesce(v_pendiente.document_storage_path, pi.document_storage_path),
           document_file_name = coalesce(v_pendiente.document_file_name, pi.document_file_name),
           document_mime_type = coalesce(v_pendiente.document_mime_type, pi.document_mime_type)
     where pi.id = v_purchase_invoice_id;

    delete from public.contabilidad_compra_lineas where compra_id = v_compra_id;

    for v_item in select value from jsonb_array_elements(v_extracted->'items') loop
      v_desc := trim(coalesce(v_item->>'description', ''));
      if v_desc = '' then continue; end if;
      v_codigo := coalesce(v_item->>'item_code', '');
      v_material_id := public.ci_resolver_material_compra_sku(v_codigo, v_entidad_id);
      v_cantidad := greatest(coalesce((v_item->>'quantity')::numeric, 1), 0.0001);
      v_precio := greatest(coalesce((v_item->>'unit_price')::numeric, 0), 0);
      insert into public.contabilidad_compra_lineas (
        compra_id, material_id, descripcion, item_code, unidad, cantidad, precio_unitario, subtotal
      ) values (
        v_compra_id,
        v_material_id,
        v_desc,
        nullif(trim(v_codigo), ''),
        coalesce(nullif(trim(v_item->>'unit'), ''), 'UND'),
        v_cantidad,
        v_precio,
        round(v_cantidad * v_precio, 2)
      );
    end loop;

    update public.contabilidad_compras cc
       set invoice_number = v_invoice_number,
           supplier_name = v_supplier_name,
           supplier_rif = v_supplier_rif,
           fecha = v_fecha,
           moneda = v_montos.moneda_original,
           moneda_original = v_montos.moneda_original,
           total_amount = v_montos.total_amount_legacy,
           monto_ves = v_montos.monto_ves,
           monto_usd = v_montos.monto_usd,
           tasa_bcv_ves_por_usd = v_montos.tasa_aplicada,
           total_amount_usd = v_montos.monto_usd,
           ubicacion_destino_id = v_recepcion.ubicacion_id,
           ingresado_almacen_at = coalesce(cc.ingresado_almacen_at, now()),
           origen = 'FRM_CONCILIADO',
           entidad_id = coalesce(v_entidad_id, cc.entidad_id),
           document_storage_path = coalesce(v_pendiente.document_storage_path, cc.document_storage_path),
           document_file_name = coalesce(v_pendiente.document_file_name, cc.document_file_name)
     where cc.id = v_compra_id;

    select cf.id into v_cf_id
      from public.compras_facturas cf
     where cf.purchase_invoice_id = v_purchase_invoice_id
     limit 1;

    if v_cf_id is not null then
      update public.compras_facturas
         set numero_factura = v_invoice_number,
             proveedor_rif = v_supplier_rif,
             proveedor_nombre = v_supplier_name,
             fecha_emision = v_fecha,
             subtotal = v_montos.monto_ves,
             total = v_montos.monto_ves,
             updated_at = now()
       where id = v_cf_id;

      delete from public.compras_factura_lineas where factura_id = v_cf_id;

      for v_item in select value from jsonb_array_elements(v_extracted->'items') loop
        v_desc := trim(coalesce(v_item->>'description', ''));
        if v_desc = '' then continue; end if;
        v_codigo := coalesce(v_item->>'item_code', '');
        v_material_id := public.ci_resolver_material_compra_sku(v_codigo, v_entidad_id);
        v_cantidad := greatest(coalesce((v_item->>'quantity')::numeric, 1), 0.0001);
        v_precio := greatest(coalesce((v_item->>'unit_price')::numeric, 0), 0);
        insert into public.compras_factura_lineas (
          factura_id, material_id, descripcion, cantidad, precio_unitario, requiere_serie
        ) values (
          v_cf_id, v_material_id, left(v_desc, 500), v_cantidad, v_precio, false
        );
      end loop;
    end if;

    v_actualizo_provisional := true;
    v_ya_existia := true;

  else
    -- ── Ruta sin compra provisional (FRM antiguo sin contabilidad_compra_id) ─
    if v_pendiente.estado = 'confirmado' and v_pendiente.purchase_invoice_id is not null then
      select c.id into v_compra_id
        from public.contabilidad_compras c
       where c.purchase_invoice_id = v_pendiente.purchase_invoice_id
       limit 1;
      v_purchase_invoice_id := v_pendiente.purchase_invoice_id;
      v_ya_existia := true;
    elsif v_pendiente.estado not in ('extraido', 'error', 'aprobado_sistema', 'procesando') then
      return jsonb_build_object(
        'success', false,
        'error', 'Estado no válido para conciliar: ' || coalesce(v_pendiente.estado, '?')
      );
    else
      v_purchase_invoice_id := coalesce(v_pendiente.purchase_invoice_id, gen_random_uuid());

      if v_pendiente.purchase_invoice_id is null then
        insert into public.purchase_invoices (
          id, invoice_number, supplier_name, supplier_rif, date, status,
          proyecto_id, ubicacion_destino_id, entidad_id,
          moneda, moneda_original, total_amount, monto_ves, monto_usd,
          tasa_bcv_ves_por_usd, total_amount_usd,
          document_storage_path, document_file_name, document_mime_type
        ) values (
          v_purchase_invoice_id,
          v_invoice_number, v_supplier_name, v_supplier_rif, v_fecha, 'REGISTRADA',
          v_recepcion.proyecto_id, v_recepcion.ubicacion_id, v_entidad_id,
          v_montos.moneda_original, v_montos.moneda_original,
          v_montos.total_amount_legacy, v_montos.monto_ves, v_montos.monto_usd,
          v_montos.tasa_aplicada, v_montos.monto_usd,
          v_pendiente.document_storage_path, v_pendiente.document_file_name, v_pendiente.document_mime_type
        );
      else
        update public.purchase_invoices pi
           set invoice_number = v_invoice_number,
               supplier_name = v_supplier_name,
               supplier_rif = v_supplier_rif,
               date = v_fecha,
               status = 'REGISTRADA',
               proyecto_id = v_recepcion.proyecto_id,
               ubicacion_destino_id = v_recepcion.ubicacion_id,
               entidad_id = coalesce(v_entidad_id, pi.entidad_id),
               moneda = v_montos.moneda_original,
               moneda_original = v_montos.moneda_original,
               total_amount = v_montos.total_amount_legacy,
               monto_ves = v_montos.monto_ves,
               monto_usd = v_montos.monto_usd,
               tasa_bcv_ves_por_usd = v_montos.tasa_aplicada,
               total_amount_usd = v_montos.monto_usd
         where pi.id = v_purchase_invoice_id;
      end if;

      select c.id into v_compra_id
        from public.contabilidad_compras c
       where c.purchase_invoice_id = v_purchase_invoice_id
       limit 1;

      if v_compra_id is null then
        insert into public.contabilidad_compras (
          purchase_invoice_id, invoice_number, supplier_rif, supplier_name, fecha,
          total_amount, moneda, moneda_original, monto_ves, monto_usd,
          tasa_bcv_ves_por_usd, total_amount_usd, origen, estado,
          proyecto_id, ubicacion_destino_id, entidad_id,
          document_storage_path, document_file_name, ingresado_almacen_at
        ) values (
          v_purchase_invoice_id, v_invoice_number, v_supplier_rif, v_supplier_name, v_fecha,
          v_montos.total_amount_legacy, v_montos.moneda_original, v_montos.moneda_original,
          v_montos.monto_ves, v_montos.monto_usd, v_montos.tasa_aplicada, v_montos.monto_usd,
          'FRM_CONCILIADO', 'REGISTRADA',
          v_recepcion.proyecto_id, v_recepcion.ubicacion_id, v_entidad_id,
          v_pendiente.document_storage_path, v_pendiente.document_file_name, now()
        )
        returning id into v_compra_id;

        for v_item in select value from jsonb_array_elements(v_extracted->'items') loop
          v_desc := trim(coalesce(v_item->>'description', ''));
          if v_desc = '' then continue; end if;
          v_codigo := coalesce(v_item->>'item_code', '');
          v_material_id := public.ci_resolver_material_compra_sku(v_codigo, v_entidad_id);
          v_cantidad := greatest(coalesce((v_item->>'quantity')::numeric, 1), 0.0001);
          v_precio := greatest(coalesce((v_item->>'unit_price')::numeric, 0), 0);
          insert into public.contabilidad_compra_lineas (
            compra_id, material_id, descripcion, item_code, unidad, cantidad, precio_unitario, subtotal
          ) values (
            v_compra_id, v_material_id, v_desc, nullif(trim(v_codigo), ''),
            coalesce(nullif(trim(v_item->>'unit'), ''), 'UND'),
            v_cantidad, v_precio, round(v_cantidad * v_precio, 2)
          );
        end loop;
      else
        v_ya_existia := true;
      end if;
    end if;
  end if;

  update public.ci_facturas_canal_pendientes
     set estado = 'confirmado',
         purchase_invoice_id = v_purchase_invoice_id,
         proyecto_id = v_recepcion.proyecto_id,
         ubicacion_destino_id = v_recepcion.ubicacion_id,
         entidad_id = coalesce(v_entidad_id, entidad_id),
         extracted = v_extracted,
         mensaje_error = null,
         updated_at = now()
   where id = p_factura_canal_id;

  v_nota := case
    when v_actualizo_provisional then
      'Conciliado fiscal sobre compra provisional ' || v_compra_id::text ||
      ' · factura canal ' || p_factura_canal_id::text
    else
      'Conciliado factura canal ' || p_factura_canal_id::text ||
      ' · compra ' || v_compra_id::text
  end;

  v_obs := trim(coalesce(v_recepcion.observaciones, ''));
  if v_obs <> '' then
    v_obs := v_obs || E'\n' || v_nota;
  else
    v_obs := v_nota;
  end if;

  update public.ci_recepciones_campo
     set factura_canal_pendiente_id = p_factura_canal_id,
         contabilidad_compra_id = v_compra_id,
         observaciones = v_obs,
         updated_at = now()
   where id = p_recepcion_campo_id;

  if not v_actualizo_provisional then
    update public.contabilidad_compras
       set ingresado_almacen_at = coalesce(ingresado_almacen_at, now())
     where id = v_compra_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Conciliación FRM completada sin duplicar stock.',
    'compra_id', v_compra_id,
    'purchase_invoice_id', v_purchase_invoice_id,
    'recepcion_campo_id', p_recepcion_campo_id,
    'ya_existia', v_ya_existia,
    'actualizo_provisional', v_actualizo_provisional
  );

exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

comment on function public.ci_conciliar_frm_con_factura_canal(uuid, uuid, jsonb, text, numeric, numeric, uuid) is
  'Concilia factura fiscal (canal) con FRM en obra. Valida tipo/estado, actualiza compra provisional o crea contabilidad sin duplicar stock.';

grant execute on function public.ci_conciliar_frm_con_factura_canal(uuid, uuid, jsonb, text, numeric, numeric, uuid)
  to service_role;

notify pgrst, 'reload schema';
