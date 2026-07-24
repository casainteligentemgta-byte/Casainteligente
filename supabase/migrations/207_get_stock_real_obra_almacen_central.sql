-- Incluye almacén central/móvil vinculado por nombre de obra (p. ej. RANCHO FLAMBOYANT
-- con ci_proyecto_id null en almacen_central pero stock físico en inventario_stock).

create or replace function public.get_stock_real_obra(
  p_proyecto_id uuid,
  p_ubicacion_id uuid default null,
  p_material_id uuid default null,
  p_solo_con_stock boolean default true
)
returns table (
  material_id uuid,
  ubicacion_id uuid,
  ubicacion_nombre text,
  ubicacion_tipo text,
  cantidad_disponible numeric,
  cantidad_reservada numeric,
  material_name text,
  material_unit text,
  material_sap_code text,
  categoria_nombre text
)
language sql
stable
security definer
set search_path = public
as $$
  with proyecto as (
    select id, lower(trim(nombre)) as nombre_norm
    from public.ci_proyectos
    where id = p_proyecto_id
  )
  select
    s.material_id,
    s.ubicacion_id,
    u.nombre as ubicacion_nombre,
    u.tipo::text as ubicacion_tipo,
    coalesce(s.cantidad_disponible, 0) as cantidad_disponible,
    coalesce(s.cantidad_reservada, 0) as cantidad_reservada,
    g.name as material_name,
    g.unit as material_unit,
    g.sap_code as material_sap_code,
    mc.name as categoria_nombre
  from public.inventario_stock s
  inner join public.inv_ubicaciones u on u.id = s.ubicacion_id and u.activo = true
  inner join public.global_inventory g on g.id = s.material_id
  left join public.material_categories mc on mc.id = g.category_id
  cross join proyecto pr
  where (
    u.ci_proyecto_id = p_proyecto_id
    or u.id in (
      with recursive arbol as (
        select id, ubicacion_padre_id, ci_proyecto_id
        from public.inv_ubicaciones
        where ci_proyecto_id = p_proyecto_id
        union all
        select hijo.id, hijo.ubicacion_padre_id, arbol.ci_proyecto_id
        from public.inv_ubicaciones hijo
        inner join arbol on hijo.ubicacion_padre_id = arbol.id
      )
      select id from arbol
    )
    or exists (
      select 1
      from public.inv_ubicaciones padre
      where padre.id = u.ubicacion_padre_id
        and padre.ci_proyecto_id = p_proyecto_id
    )
    or (
      u.tipo in ('almacen_central', 'almacen_movil')
      and (
        lower(trim(u.nombre)) = pr.nombre_norm
        or lower(trim(u.nombre)) like '%' || pr.nombre_norm || '%'
        or pr.nombre_norm like '%' || lower(trim(u.nombre)) || '%'
        or exists (
          select 1
          from public.inv_ubicaciones u_obra
          where u_obra.ci_proyecto_id = p_proyecto_id
            and u_obra.tipo = 'obra'
            and lower(trim(u_obra.nombre)) = lower(trim(u.nombre))
        )
        or exists (
          select 1
          from public.inventory_deposits d
          where d.id = u.deposit_id
            and (
              lower(trim(d.name)) = pr.nombre_norm
              or lower(trim(coalesce(d.locality, ''))) = pr.nombre_norm
            )
        )
      )
    )
  )
  and (p_ubicacion_id is null or s.ubicacion_id = p_ubicacion_id)
  and (p_material_id is null or s.material_id = p_material_id)
  and (
    not p_solo_con_stock
    or coalesce(s.cantidad_disponible, 0) > 0
  )
  order by g.name, u.nombre;
$$;

comment on function public.get_stock_real_obra is
  'Stock físico por material y ubicación de una obra (inventario_stock), incl. almacén central por nombre.';

grant execute on function public.get_stock_real_obra(uuid, uuid, uuid, boolean) to anon;
grant execute on function public.get_stock_real_obra(uuid, uuid, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
