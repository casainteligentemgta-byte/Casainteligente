-- D-03 + D-04: vínculo procura ↔ recepción campo y actualización automática recibida/recibida_parcial.

alter table public.ci_recepciones_campo
  add column if not exists procura_id uuid
    references public.ci_procuras (id) on delete set null;

create index if not exists idx_ci_recepciones_campo_procura
  on public.ci_recepciones_campo (procura_id)
  where procura_id is not null;

comment on column public.ci_recepciones_campo.procura_id is
  'Procura origen (PR-*) cuando el ingreso en campo satisface una solicitud de abastecimiento.';

-- Recalcula SUM(cantidad) recibida vs ci_procuras.cantidad y actualiza estado.
create or replace function public.ci_procura_actualizar_recepcion(
  p_recepcion_id uuid default null,
  p_procura_id uuid default null,
  p_motivo text default null
)
returns table (
  procura_id uuid,
  ticket text,
  material_txt text,
  estado_anterior text,
  estado_nuevo text,
  cantidad_solicitada numeric,
  cantidad_recibida numeric,
  actualizado boolean,
  telegram_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_procura_id uuid;
  v_row public.ci_procuras;
  v_estado_anterior text;
  v_estado_nuevo text;
  v_cant_solicitada numeric;
  v_cant_recibida numeric;
  v_chat bigint;
  v_motivo text;
begin
  v_procura_id := p_procura_id;

  if v_procura_id is null and p_recepcion_id is not null then
    select r.procura_id into v_procura_id
    from public.ci_recepciones_campo r
    where r.id = p_recepcion_id;
  end if;

  if v_procura_id is null then
    return;
  end if;

  select * into v_row
  from public.ci_procuras p
  where p.id = v_procura_id
  for update;

  if not found then
    raise exception 'Procura no encontrada: %', v_procura_id;
  end if;

  v_estado_anterior := v_row.estado;
  v_cant_solicitada := coalesce(v_row.cantidad, 0);

  procura_id := v_row.id;
  ticket := v_row.ticket;
  material_txt := v_row.material_txt;
  estado_anterior := v_estado_anterior;
  cantidad_solicitada := v_cant_solicitada;

  if v_estado_anterior not in (
    'en_compra',
    'recibida_parcial',
    'aprobada',
    'aprobada_directa'
  ) then
    cantidad_recibida := 0;
    estado_nuevo := v_estado_anterior;
    actualizado := false;
    telegram_id := null;
    return next;
  end if;

  select coalesce(sum(l.cantidad), 0) into v_cant_recibida
  from public.ci_recepciones_campo r
  join public.ci_recepciones_campo_lineas l on l.recepcion_id = r.id
  where r.procura_id = v_procura_id
    and r.estado = 'registrado'
    and (
      v_row.material_id is null
      or l.material_id = v_row.material_id
    );

  cantidad_recibida := v_cant_recibida;

  if v_cant_recibida <= 0 then
    estado_nuevo := v_estado_anterior;
    actualizado := false;
    telegram_id := null;
    return next;
  end if;

  if v_cant_recibida >= v_cant_solicitada then
    v_estado_nuevo := 'recibida';
  else
    v_estado_nuevo := 'recibida_parcial';
  end if;

  estado_nuevo := v_estado_nuevo;

  if v_estado_nuevo = v_estado_anterior then
    actualizado := false;
    v_chat := public.ci_procura_resolver_telegram_chat_id(v_row);
    telegram_id := case when v_chat is not null then v_chat::text else null end;
    return next;
  end if;

  v_motivo := coalesce(
    nullif(btrim(coalesce(p_motivo, '')), ''),
    format(
      'Recepción acumulada %.4f / %.4f %s',
      v_cant_recibida,
      v_cant_solicitada,
      coalesce(nullif(btrim(v_row.unidad), ''), 'UND')
    )
  );

  insert into public.ci_procura_estados_historial (
    procura_id,
    estado_anterior,
    estado_nuevo,
    motivo
  ) values (
    v_row.id,
    v_estado_anterior,
    v_estado_nuevo,
    v_motivo
  );

  update public.ci_procuras p
  set
    estado = v_estado_nuevo,
    motivo_ultimo = v_motivo,
    updated_at = now()
  where p.id = v_row.id
  returning * into v_row;

  actualizado := true;
  v_chat := public.ci_procura_resolver_telegram_chat_id(v_row);
  telegram_id := case when v_chat is not null then v_chat::text else null end;
  return next;
end;
$$;

comment on function public.ci_procura_actualizar_recepcion(uuid, uuid, text) is
  'D-04: SUM recepciones campo vinculadas vs cantidad procura → recibida_parcial / recibida. Solo service_role.';

revoke execute on function public.ci_procura_actualizar_recepcion(uuid, uuid, text) from public;
revoke execute on function public.ci_procura_actualizar_recepcion(uuid, uuid, text) from anon;
revoke execute on function public.ci_procura_actualizar_recepcion(uuid, uuid, text) from authenticated;
grant execute on function public.ci_procura_actualizar_recepcion(uuid, uuid, text) to service_role;

-- Extiende ingreso campo con procura_id opcional (D-03).
drop function if exists public.ci_registrar_ingreso_manual_campo(
  uuid, uuid, uuid, varchar, varchar, jsonb, uuid
);

create or replace function public.ci_registrar_ingreso_manual_campo(
  p_proyecto_id uuid,
  p_ubicacion_id uuid,
  p_proveedor_id uuid,
  p_tipo varchar,
  p_num_doc varchar,
  p_lineas jsonb,
  p_usuario_id uuid,
  p_procura_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recepcion_id uuid;
  v_line jsonb;
  v_material_id uuid;
  v_cantidad numeric;
  v_unidad text;
  v_descripcion text;
  v_obs text;
  v_forma text;
  v_soporte_path text;
  v_soporte_name text;
  v_soporte_mime text;
  v_orden integer := 0;
  v_tipo text;
begin
  if p_proyecto_id is null or p_ubicacion_id is null then
    raise exception 'proyecto_id y ubicacion_id son obligatorios';
  end if;

  if p_procura_id is not null and not exists (
    select 1 from public.ci_procuras where id = p_procura_id
  ) then
    raise exception 'Procura no encontrada: %', p_procura_id;
  end if;

  v_tipo := lower(trim(coalesce(p_tipo, '')));
  if v_tipo not in ('nota_entrega', 'emergencia', 'factura_canal') then
    raise exception 'tipo inválido: %', p_tipo;
  end if;

  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Debe indicar al menos una línea de material';
  end if;

  if not exists (select 1 from public.ci_proyectos where id = p_proyecto_id) then
    raise exception 'Proyecto no encontrado';
  end if;

  if not exists (
    select 1 from public.inv_ubicaciones u
    where u.id = p_ubicacion_id and u.activo = true
  ) then
    raise exception 'Ubicación de inventario no encontrada o inactiva';
  end if;

  if p_proveedor_id is not null and not exists (select 1 from public.empresas where id = p_proveedor_id) then
    raise exception 'Proveedor (empresa) no encontrado';
  end if;

  insert into public.ci_recepciones_campo (
    proyecto_id,
    ubicacion_id,
    proveedor_id,
    tipo,
    num_doc,
    registrado_por,
    estado,
    procura_id
  )
  values (
    p_proyecto_id,
    p_ubicacion_id,
    p_proveedor_id,
    v_tipo,
    coalesce(nullif(trim(p_num_doc), ''), 'S/N'),
    p_usuario_id,
    'registrado',
    p_procura_id
  )
  returning id into v_recepcion_id;

  for v_line in select value from jsonb_array_elements(p_lineas)
  loop
    v_material_id := nullif(trim(v_line->>'material_id'), '')::uuid;
    v_cantidad := (v_line->>'cantidad')::numeric;
    v_unidad := coalesce(nullif(trim(v_line->>'unidad'), ''), 'UND');
    v_descripcion := coalesce(nullif(trim(v_line->>'descripcion'), ''), '');
    v_obs := nullif(trim(v_line->>'observaciones'), '');
    v_forma := lower(trim(coalesce(v_line->>'forma_ingreso', 'sin_nota')));
    if v_forma not in ('con_factura', 'con_nota', 'sin_nota', 'pendiente_factura') then
      v_forma := 'sin_nota';
    end if;
    v_soporte_path := nullif(trim(v_line->>'soporte_storage_path'), '');
    v_soporte_name := nullif(trim(v_line->>'soporte_file_name'), '');
    v_soporte_mime := nullif(trim(v_line->>'soporte_mime_type'), '');

    if v_material_id is null then
      raise exception 'Cada línea debe incluir material_id válido';
    end if;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida en línea de material %', v_material_id;
    end if;
    if not exists (select 1 from public.global_inventory where id = v_material_id) then
      raise exception 'Material % no existe en global_inventory', v_material_id;
    end if;

    if v_descripcion = '' then
      select coalesce(g.name, 'Material') into v_descripcion
      from public.global_inventory g where g.id = v_material_id;
    end if;

    v_orden := v_orden + 1;

    insert into public.ci_recepciones_campo_lineas (
      recepcion_id,
      material_id,
      cantidad,
      unidad,
      descripcion,
      observaciones,
      forma_ingreso,
      soporte_storage_path,
      soporte_file_name,
      soporte_mime_type,
      orden
    )
    values (
      v_recepcion_id,
      v_material_id,
      v_cantidad,
      v_unidad,
      v_descripcion,
      v_obs,
      v_forma,
      v_soporte_path,
      v_soporte_name,
      v_soporte_mime,
      v_orden
    );

    perform public.inv_stock_apply_delta(
      p_ubicacion_id,
      v_material_id,
      v_cantidad,
      0,
      0,
      'recepcion_campo',
      'ci_recepciones_campo',
      v_recepcion_id,
      null,
      format('Ingreso campo %s · %s', v_tipo, coalesce(nullif(trim(p_num_doc), ''), 'S/N'))
    );
  end loop;

  return v_recepcion_id;
end;
$$;

comment on function public.ci_registrar_ingreso_manual_campo(
  uuid, uuid, uuid, varchar, varchar, jsonb, uuid, uuid
) is
  'FRM Telegram/web: recepción + stock + opcional procura_id (D-03) y sync estado procura (D-04).';

grant execute on function public.ci_registrar_ingreso_manual_campo(
  uuid, uuid, uuid, varchar, varchar, jsonb, uuid, uuid
) to authenticated, service_role, anon;

notify pgrst, 'reload schema';
