-- Almacenes centrales (LA OFICINA, TERRENO JC) → inventory_deposits.entidad_id
-- Elimina proyectos puente tipo talento (migr. 248) y reclasifica OpEx DIMAQUINAS.
-- Repara borrado de ci_proyectos (inv_ubicaciones_tipo_obra).

-- ── 1. Patrono en depósitos físicos ───────────────────────────────────────────
alter table public.inventory_deposits
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

create index if not exists idx_inventory_deposits_entidad
  on public.inventory_deposits (entidad_id)
  where entidad_id is not null;

comment on column public.inventory_deposits.entidad_id is
  'Patrono / empresa dueña del almacén central (filtros de inventario sin proyecto puente).';

-- ── 2. Datos: DIMAQUINAS, almacenes, OpEx, limpieza puente ───────────────────
do $$
declare
  v_dima_id uuid;
  v_ofi_proy_id uuid;
  v_terr_proy_id uuid;
  v_ofi_dep_id uuid;
  v_terr_dep_id uuid;
  r record;
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
    raise notice '264: entidad DIMAQUINAS no encontrada; se omiten ajustes de datos.';
    return;
  end if;

  -- Depósitos → entidad DIMAQUINAS
  update public.inventory_deposits d
     set entidad_id = v_dima_id
   where lower(trim(d.name)) in (lower(trim('LA OFICINA')), lower(trim('TERRENO JC')))
      or lower(trim(d.code)) in ('ofi', 'terrjc', 'terreno jc');

  select id into v_ofi_dep_id
    from public.inventory_deposits
   where lower(trim(name)) = lower(trim('LA OFICINA'))
   order by created_at
   limit 1;

  select id into v_terr_dep_id
    from public.inventory_deposits
   where lower(trim(name)) = lower(trim('TERRENO JC'))
   order by created_at
   limit 1;

  select id into v_ofi_proy_id
    from public.ci_proyectos
   where lower(trim(nombre)) = lower(trim('LA OFICINA'))
   limit 1;

  select id into v_terr_proy_id
    from public.ci_proyectos
   where lower(trim(nombre)) = lower(trim('TERRENO JC'))
   limit 1;

  -- Inventario catálogo: quitar proyecto puente, mantener entidad
  if v_ofi_proy_id is not null or v_terr_proy_id is not null then
    update public.global_inventory gi
       set entidad_id = coalesce(gi.entidad_id, v_dima_id),
           proyecto_id = null,
           updated_at = now()
     where gi.proyecto_id in (
       select id from public.ci_proyectos
        where id in (v_ofi_proy_id, v_terr_proy_id)
           or lower(trim(nombre)) in (lower(trim('LA OFICINA')), lower(trim('TERRENO JC')))
     );
  end if;

  -- Compras contables: desvincular proyecto puente (mantener entidad en fila si existe)
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'contabilidad_compras'
       and column_name = 'proyecto_id'
  ) then
    update public.contabilidad_compras cc
       set proyecto_id = null
     where cc.proyecto_id in (
       select id from public.ci_proyectos
        where lower(trim(nombre)) in (lower(trim('LA OFICINA')), lower(trim('TERRENO JC')))
     );
  end if;

  -- Fusionar stock de ubicaciones obra-puente → almacén central del depósito
  for r in
    select
      u_obr.id as obra_ubic_id,
      u_dep.id as dep_ubic_id
    from public.inv_ubicaciones u_obr
    join public.ci_proyectos p on p.id = u_obr.ci_proyecto_id
    left join public.inventory_deposits d
      on lower(trim(d.name)) = lower(trim(p.nombre))
    left join public.inv_ubicaciones u_dep
      on u_dep.deposit_id = d.id
     and u_dep.tipo = 'almacen_central'
   where u_obr.tipo = 'obra'
     and u_obr.ubicacion_padre_id is null
     and lower(trim(p.nombre)) in (lower(trim('LA OFICINA')), lower(trim('TERRENO JC')))
     and u_dep.id is not null
  loop
    insert into public.inventario_stock (ubicacion_id, material_id, cantidad_disponible, cantidad_reservada, cantidad_en_transito_entrante)
    select
      r.dep_ubic_id,
      s.material_id,
      s.cantidad_disponible,
      s.cantidad_reservada,
      s.cantidad_en_transito_entrante
    from public.inventario_stock s
    where s.ubicacion_id = r.obra_ubic_id
    on conflict (ubicacion_id, material_id) do update
      set cantidad_disponible = public.inventario_stock.cantidad_disponible + excluded.cantidad_disponible,
          cantidad_reservada = public.inventario_stock.cantidad_reservada + excluded.cantidad_reservada,
          cantidad_en_transito_entrante = public.inventario_stock.cantidad_en_transito_entrante + excluded.cantidad_en_transito_entrante,
          updated_at = now();

    delete from public.inventario_stock where ubicacion_id = r.obra_ubic_id;
  end loop;

  -- Quitar vínculo proyecto en ubicaciones almacén (el patrono va en el depósito)
  update public.inv_ubicaciones u
     set ci_proyecto_id = null,
         updated_at = now()
    from public.inventory_deposits d
   where u.deposit_id = d.id
     and d.entidad_id = v_dima_id
     and lower(trim(d.name)) in (lower(trim('LA OFICINA')), lower(trim('TERRENO JC')));

  -- Borrar ubicaciones obra-puente
  delete from public.inv_ubicaciones u
   where u.tipo = 'obra'
     and u.ubicacion_padre_id is null
     and (
       u.codigo in ('OBR-OFI', 'OBR-TERRJC')
       or u.ci_proyecto_id in (
         select id from public.ci_proyectos
          where lower(trim(nombre)) in (lower(trim('LA OFICINA')), lower(trim('TERRENO JC')))
       )
     );

  -- Borrar proyectos puente almacén
  delete from public.ci_proyectos p
   where lower(trim(p.nombre)) in (lower(trim('LA OFICINA')), lower(trim('TERRENO JC')))
     and coalesce(p.tipo_proyecto, 'integral') = 'talento';

  -- OpEx DIMAQUINAS → centro de costo de entidad
  update public.ci_proyectos p
     set naturaleza_proyecto = 'centro_costo_entidad',
         clasificacion_gasto_entidad = coalesce(p.clasificacion_gasto_entidad, 'operacional'),
         entidad_id = v_dima_id,
         observaciones = trim(both from coalesce(p.observaciones, '') || ' — Gasto operativo entidad (migr. 264).')
   where p.entidad_id = v_dima_id
     and coalesce(p.naturaleza_proyecto, 'obra_construccion') = 'obra_construccion'
     and (
       lower(trim(p.nombre)) like '%operativ%'
       or lower(trim(p.nombre)) like '%gasto%operativ%'
       or lower(trim(p.nombre)) like '%opex%'
     )
     and lower(trim(p.nombre)) not in (lower(trim('LA OFICINA')), lower(trim('TERRENO JC')));

  -- Heredar clasificación OpEx al catálogo
  update public.global_inventory gi
     set clasificacion_gasto_entidad = p.clasificacion_gasto_entidad,
         entidad_id = coalesce(gi.entidad_id, p.entidad_id),
         updated_at = now()
    from public.ci_proyectos p
   where gi.proyecto_id = p.id
     and p.naturaleza_proyecto = 'centro_costo_entidad'
     and p.clasificacion_gasto_entidad is not null
     and gi.clasificacion_gasto_entidad is distinct from p.clasificacion_gasto_entidad;
end;
$$;

-- ── 3. Borrado seguro de proyectos (evita inv_ubicaciones_tipo_obra) ─────────
create or replace function public.inv_trg_ci_proyecto_before_delete_ubicacion_obra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.inv_ubicaciones u
   where u.ci_proyecto_id = OLD.id
     and u.tipo = 'obra'
     and u.ubicacion_padre_id is null;
  return OLD;
end;
$$;

drop trigger if exists tr_inv_ci_proyecto_before_delete_ubicacion on public.ci_proyectos;
create trigger tr_inv_ci_proyecto_before_delete_ubicacion
  before delete on public.ci_proyectos
  for each row
  execute function public.inv_trg_ci_proyecto_before_delete_ubicacion_obra();

comment on function public.inv_trg_ci_proyecto_before_delete_ubicacion_obra() is
  'Elimina ubicaciones obra raíz antes de borrar ci_proyectos (evita violar inv_ubicaciones_tipo_obra por SET NULL).';

notify pgrst, 'reload schema';
