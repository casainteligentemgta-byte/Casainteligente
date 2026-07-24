-- Recepción campo Telegram/web: stock con tipo recepcion_campo y referencia al FRM.

create or replace function public.ci_registrar_ingreso_manual_campo(
  p_proyecto_id uuid,
  p_ubicacion_id uuid,
  p_proveedor_id uuid,
  p_tipo varchar,
  p_num_doc varchar,
  p_lineas jsonb,
  p_usuario_id uuid
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
    estado
  )
  values (
    p_proyecto_id,
    p_ubicacion_id,
    p_proveedor_id,
    v_tipo,
    coalesce(nullif(trim(p_num_doc), ''), 'S/N'),
    p_usuario_id,
    'registrado'
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

comment on function public.ci_registrar_ingreso_manual_campo is
  'FRM Telegram/web: recepción + stock disponible (recepcion_campo) sin duplicar tránsito compra.';

notify pgrst, 'reload schema';
