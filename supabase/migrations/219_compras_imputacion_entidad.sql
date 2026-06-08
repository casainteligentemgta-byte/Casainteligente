-- Imputación contable: obra (valuación AD) vs entidad (OpEx patrono, fuera de AD).

alter table public.contabilidad_compras
  add column if not exists imputacion text not null default 'obra'
    check (imputacion in ('obra', 'entidad'));

create index if not exists idx_contabilidad_compras_imputacion
  on public.contabilidad_compras (imputacion, proyecto_id)
  where imputacion = 'entidad';

comment on column public.contabilidad_compras.imputacion is
  'obra = costo directo de proyecto (entra en valuación AD). entidad = gasto del patrono (excluido de AD).';

create or replace view public.ci_compras as
select
  id,
  proyecto_id,
  total_amount as monto_total,
  fecha as fecha_factura,
  valuacion_delegada_id
from public.contabilidad_compras
where coalesce(imputacion, 'obra') = 'obra'
  and proyecto_id is not null;

comment on view public.ci_compras is
  'Compras imputadas a obra para valuación delegada (excluye gastos de entidad).';

notify pgrst, 'reload schema';
