-- Obras LA OFICINA y TERRENO JC bajo DIMAQUINAS, c.a + vínculo en inv_ubicaciones.
-- Corrige 6 ingresos en tránsito que no entraban al filtro por entidad Di Máquinas.

do $$
declare
  v_dima_id uuid;
  v_customer_id uuid;
  v_ofi_proy_id uuid;
  v_terr_proy_id uuid;
begin
  select id into v_dima_id
    from public.ci_entidades
   where lower(trim(nombre)) like '%dimaquina%'
      or lower(trim(nombre)) like '%dimáquina%'
      or lower(coalesce(nombre_comercial, '')) like '%dimaquina%'
      or lower(coalesce(nombre_comercial, '')) like '%dimáquina%'
   order by created_at
   limit 1;

  if v_dima_id is null then
    raise exception 'No se encontró entidad DIMAQUINAS';
  end if;

  select p.customer_id into v_customer_id
    from public.ci_proyectos p
   where p.entidad_id = v_dima_id
     and p.customer_id is not null
   order by p.created_at
   limit 1;

  if v_customer_id is null then
    raise exception 'No hay customer_id de referencia en proyectos DIMAQUINAS';
  end if;

  select id into v_ofi_proy_id
    from public.ci_proyectos
   where lower(trim(nombre)) = lower(trim('LA OFICINA'))
   limit 1;

  if v_ofi_proy_id is null then
    insert into public.ci_proyectos (
      nombre,
      nombre_proyecto,
      customer_id,
      estado,
      ubicacion_texto,
      entidad_id,
      tipo_proyecto,
      observaciones
    )
    values (
      'LA OFICINA',
      'LA OFICINA',
      v_customer_id,
      'ejecucion',
      'LA OFICINA',
      v_dima_id,
      'talento',
      'Almacén central LA OFICINA — asignado a DIMAQUINAS, c.a (migr. 248).'
    )
    returning id into v_ofi_proy_id;
  else
    update public.ci_proyectos
       set entidad_id = v_dima_id,
           updated_at = now()
     where id = v_ofi_proy_id
       and entidad_id is distinct from v_dima_id;
  end if;

  select id into v_terr_proy_id
    from public.ci_proyectos
   where lower(trim(nombre)) = lower(trim('TERRENO JC'))
   limit 1;

  if v_terr_proy_id is null then
    insert into public.ci_proyectos (
      nombre,
      nombre_proyecto,
      customer_id,
      estado,
      ubicacion_texto,
      entidad_id,
      tipo_proyecto,
      observaciones
    )
    values (
      'TERRENO JC',
      'TERRENO JC',
      v_customer_id,
      'ejecucion',
      'TERRENO JC',
      v_dima_id,
      'talento',
      'Almacén central TERRENO JC — asignado a DIMAQUINAS, c.a (migr. 248).'
    )
    returning id into v_terr_proy_id;
  else
    update public.ci_proyectos
       set entidad_id = v_dima_id,
           updated_at = now()
     where id = v_terr_proy_id
       and entidad_id is distinct from v_dima_id;
  end if;

  update public.inv_ubicaciones u
     set ci_proyecto_id = v_ofi_proy_id,
         updated_at = now()
   where lower(trim(u.nombre)) = lower(trim('LA OFICINA'))
     and u.ci_proyecto_id is distinct from v_ofi_proy_id;

  update public.inv_ubicaciones u
     set ci_proyecto_id = v_terr_proy_id,
         updated_at = now()
   where lower(trim(u.nombre)) = lower(trim('TERRENO JC'))
     and u.ci_proyecto_id is distinct from v_terr_proy_id;

  insert into public.inv_ubicaciones (codigo, nombre, tipo, ci_proyecto_id, activo)
  select 'OBR-OFI', 'LA OFICINA', 'obra', v_ofi_proy_id, true
   where not exists (
     select 1
       from public.inv_ubicaciones u
      where u.tipo = 'obra'
        and u.ci_proyecto_id = v_ofi_proy_id
   );

  insert into public.inv_ubicaciones (codigo, nombre, tipo, ci_proyecto_id, activo)
  select 'OBR-TERRJC', 'TERRENO JC', 'obra', v_terr_proy_id, true
   where not exists (
     select 1
       from public.inv_ubicaciones u
      where u.tipo = 'obra'
        and u.ci_proyecto_id = v_terr_proy_id
   );
end;
$$;

notify pgrst, 'reload schema';
