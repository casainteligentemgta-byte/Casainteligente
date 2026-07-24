-- Repara efectos de la migracion 264 cuando haya sido aplicada manualmente.
-- No elimina inventory_deposits.entidad_id: la columna queda disponible para usos futuros.

-- El merge de stock que hizo la 264 no se puede deshacer de forma segura sin un
-- snapshot previo por material/ubicacion; por eso esta migracion no intenta
-- separar nuevamente inventario ya fusionado.

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
      or lower(trim(nombre)) like '%dimaquinas%'
      or lower(coalesce(nombre_comercial, '')) like '%dimaquina%'
      or lower(coalesce(nombre_comercial, '')) like '%dimaquinas%'
   order by created_at
   limit 1;

  if v_dima_id is null then
    raise notice '265: entidad DIMAQUINAS no encontrada; se omite recreacion de proyectos puente.';
  else
    select p.customer_id into v_customer_id
      from public.ci_proyectos p
     where p.entidad_id = v_dima_id
       and p.customer_id is not null
     order by p.created_at
     limit 1;

    if v_customer_id is null then
      raise notice '265: no hay customer_id de referencia para DIMAQUINAS; se omite recreacion de proyectos puente.';
    else
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
          'Almacen central LA OFICINA - recreado por reparacion revert migr. 264.'
        )
        returning id into v_ofi_proy_id;
      else
        update public.ci_proyectos
           set entidad_id = v_dima_id,
               tipo_proyecto = 'talento',
               updated_at = now()
         where id = v_ofi_proy_id
           and (
             entidad_id is distinct from v_dima_id
             or coalesce(tipo_proyecto, '') <> 'talento'
           );
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
          'Almacen central TERRENO JC - recreado por reparacion revert migr. 264.'
        )
        returning id into v_terr_proy_id;
      else
        update public.ci_proyectos
           set entidad_id = v_dima_id,
               tipo_proyecto = 'talento',
               updated_at = now()
         where id = v_terr_proy_id
           and (
             entidad_id is distinct from v_dima_id
             or coalesce(tipo_proyecto, '') <> 'talento'
           );
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
    end if;
  end if;

  update public.ci_proyectos
     set naturaleza_proyecto = 'obra_construccion',
         updated_at = now()
   where naturaleza_proyecto = 'centro_costo_entidad'
     and observaciones ilike '%migr. 264%';
end;
$$;

-- La 264 creo este trigger para permitir borrar proyectos puente. Al revertir
-- el flujo anterior, se elimina si existe.
drop trigger if exists tr_inv_ci_proyecto_before_delete_ubicacion on public.ci_proyectos;

notify pgrst, 'reload schema';
