-- Blindaje bimonetario explícito en compras (VES + USD + moneda de origen).

alter table public.purchase_invoices
  add column if not exists monto_ves numeric(15, 2),
  add column if not exists monto_usd numeric(15, 2),
  add column if not exists moneda_original text;

alter table public.contabilidad_compras
  add column if not exists monto_ves numeric(15, 2),
  add column if not exists monto_usd numeric(15, 2),
  add column if not exists moneda_original text;

update public.purchase_invoices
set
  monto_ves = coalesce(monto_ves, total_amount),
  monto_usd = coalesce(monto_usd, total_amount_usd),
  moneda_original = coalesce(moneda_original, moneda, 'VES')
where monto_ves is null or monto_usd is null or moneda_original is null;

update public.contabilidad_compras
set
  monto_ves = coalesce(monto_ves, total_amount),
  monto_usd = coalesce(monto_usd, total_amount_usd),
  moneda_original = coalesce(moneda_original, moneda, 'VES')
where monto_ves is null or monto_usd is null or moneda_original is null;

create or replace view public.ci_compras as
select
  id,
  proyecto_id,
  coalesce(monto_ves, total_amount) as monto_total,
  monto_ves,
  monto_usd,
  coalesce(moneda_original, moneda) as moneda_original,
  tasa_bcv_ves_por_usd as tasa_bcv_fecha,
  fecha as fecha_factura,
  valuacion_delegada_id
from public.contabilidad_compras
where proyecto_id is not null;

comment on column public.contabilidad_compras.monto_ves is 'Total de la factura en bolívares (normalizado).';
comment on column public.contabilidad_compras.monto_usd is 'Total equivalente en USD con tasa BCV.';
comment on column public.contabilidad_compras.moneda_original is 'Moneda en que se digitó la factura (VES o USD).';

notify pgrst, 'reload schema';
