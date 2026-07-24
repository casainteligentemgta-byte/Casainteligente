-- Área por capítulo para Control de Presupuesto Estimado (CCO V4).
-- Permite $/m² por capítulo y análisis módulos vs obras generales.

alter table public.cco_presupuestos_capitulo
  add column if not exists area_m2 numeric(14, 2) not null default 0;

comment on column public.cco_presupuestos_capitulo.area_m2 is
  'Área del capítulo en m² (editable en Presupuestos V4). Los módulos suman la base $/m².';

notify pgrst, 'reload schema';
