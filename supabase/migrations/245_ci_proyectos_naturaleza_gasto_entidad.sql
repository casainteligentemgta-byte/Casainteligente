-- Distingue obras de construcción vs centros de costo OpEx de la entidad.
-- Alinea inventario y filtros de almacén con imputacion = entidad en contabilidad.

alter table public.ci_proyectos
  add column if not exists naturaleza_proyecto text not null default 'obra_construccion'
    check (naturaleza_proyecto in ('obra_construccion', 'centro_costo_entidad'));

alter table public.ci_proyectos
  add column if not exists clasificacion_gasto_entidad text
    check (
      clasificacion_gasto_entidad is null
      or clasificacion_gasto_entidad in ('operacional', 'administrativo', 'servicio')
    );

create index if not exists idx_ci_proyectos_naturaleza_entidad
  on public.ci_proyectos (entidad_id, naturaleza_proyecto, clasificacion_gasto_entidad)
  where naturaleza_proyecto = 'centro_costo_entidad';

comment on column public.ci_proyectos.naturaleza_proyecto is
  'obra_construccion = obra real con presupuesto/AD. centro_costo_entidad = gasto del patrono (OpEx), no es obra.';

comment on column public.ci_proyectos.clasificacion_gasto_entidad is
  'Solo si naturaleza_proyecto = centro_costo_entidad: operacional, administrativo o servicio.';

alter table public.global_inventory
  add column if not exists clasificacion_gasto_entidad text
    check (
      clasificacion_gasto_entidad is null
      or clasificacion_gasto_entidad in ('operacional', 'administrativo', 'servicio')
    );

create index if not exists idx_global_inventory_clasif_gasto_entidad
  on public.global_inventory (entidad_id, clasificacion_gasto_entidad)
  where clasificacion_gasto_entidad is not null;

comment on column public.global_inventory.clasificacion_gasto_entidad is
  'Tipo OpEx del material a nivel entidad (operacional, administrativo, servicio). Complementa imputacion en compras.';

-- Centros de costo: nombres habituales de pseudo-obras OpEx
update public.ci_proyectos
   set naturaleza_proyecto = 'centro_costo_entidad',
       clasificacion_gasto_entidad = coalesce(clasificacion_gasto_entidad, 'operacional')
 where naturaleza_proyecto = 'obra_construccion'
   and (
     lower(trim(nombre)) like '%gasto%operativ%'
     or lower(trim(nombre)) like '%gastos%operativ%'
     or lower(trim(nombre)) like '%opex%'
     or lower(trim(nombre)) = 'gasto operacional'
     or lower(trim(nombre)) = 'gasto operativo'
   );

update public.ci_proyectos
   set naturaleza_proyecto = 'centro_costo_entidad',
       clasificacion_gasto_entidad = coalesce(clasificacion_gasto_entidad, 'administrativo')
 where naturaleza_proyecto = 'obra_construccion'
   and (
     lower(trim(nombre)) like '%gasto%administrativ%'
     or lower(trim(nombre)) like '%gastos%administrativ%'
   );

update public.ci_proyectos
   set naturaleza_proyecto = 'centro_costo_entidad',
       clasificacion_gasto_entidad = coalesce(clasificacion_gasto_entidad, 'servicio')
 where naturaleza_proyecto = 'obra_construccion'
   and lower(trim(nombre)) like '%servicio%'
   and lower(trim(nombre)) not like '%obra%';

-- Materiales en centros de costo heredan clasificación
update public.global_inventory gi
   set clasificacion_gasto_entidad = p.clasificacion_gasto_entidad,
       updated_at = now()
  from public.ci_proyectos p
 where gi.proyecto_id = p.id
   and p.naturaleza_proyecto = 'centro_costo_entidad'
   and p.clasificacion_gasto_entidad is not null
   and gi.clasificacion_gasto_entidad is distinct from p.clasificacion_gasto_entidad;

notify pgrst, 'reload schema';
