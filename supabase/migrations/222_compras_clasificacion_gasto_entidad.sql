-- Clasificación OpEx del patrono (solo imputacion = entidad).

alter table public.contabilidad_compras
  add column if not exists clasificacion_gasto_entidad text
    check (
      clasificacion_gasto_entidad is null
      or clasificacion_gasto_entidad in ('operacional', 'administrativo', 'servicio')
    );

create index if not exists idx_contabilidad_compras_clasif_entidad
  on public.contabilidad_compras (entidad_id, clasificacion_gasto_entidad, fecha)
  where imputacion = 'entidad';

comment on column public.contabilidad_compras.clasificacion_gasto_entidad is
  'Tipo de gasto del patrono: operacional, administrativo o servicio. Solo aplica si imputacion = entidad.';

notify pgrst, 'reload schema';
