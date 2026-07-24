-- Columna Talento (086). Si la migración 086 no corrió completa o el esquema quedó a medias,
-- PostgREST / vistas como ci_obras fallan al referenciar obra_precio_venta_usd.
alter table public.ci_proyectos
  add column if not exists obra_precio_venta_usd numeric(14, 2);

comment on column public.ci_proyectos.obra_precio_venta_usd is
  'Precio de venta del contrato Talento (USD). Unificado desde ex ci_obras.';

notify pgrst, 'reload schema';
