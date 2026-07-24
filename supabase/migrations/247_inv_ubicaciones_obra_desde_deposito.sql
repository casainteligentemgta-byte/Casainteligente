-- Vincular almacenes centrales/móviles sin obra al proyecto del mismo nombre o depósito.
-- Corrige p. ej. RANCHO FLAMBOYANT (almacen_central con deposit_id pero sin ci_proyecto_id).

update public.inv_ubicaciones u
   set ci_proyecto_id = p.id,
       updated_at = now()
  from public.ci_proyectos p
 where u.ci_proyecto_id is null
   and u.tipo in ('almacen_central', 'almacen_movil')
   and lower(trim(u.nombre)) = lower(trim(p.nombre));

update public.inv_ubicaciones u
   set ci_proyecto_id = p.id,
       updated_at = now()
  from public.inventory_deposits d
  join public.ci_proyectos p
    on lower(trim(d.name)) = lower(trim(p.nombre))
 where u.deposit_id = d.id
   and u.ci_proyecto_id is null
   and u.tipo in ('almacen_central', 'almacen_movil');

notify pgrst, 'reload schema';
