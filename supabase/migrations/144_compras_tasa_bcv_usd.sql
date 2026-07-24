-- Tasa BCV del día de la factura y total equivalente en USD (compras / recepción).

alter table public.purchase_invoices
  add column if not exists moneda text not null default 'VES',
  add column if not exists tasa_bcv_ves_por_usd numeric(18, 6),
  add column if not exists total_amount_usd numeric(15, 2);

alter table public.contabilidad_compras
  add column if not exists tasa_bcv_ves_por_usd numeric(18, 6),
  add column if not exists total_amount_usd numeric(15, 2);

comment on column public.purchase_invoices.tasa_bcv_ves_por_usd is
  'Tasa oficial BCV (bolívares por 1 USD) vigente en la fecha de la factura.';
comment on column public.purchase_invoices.total_amount_usd is
  'Total de la factura convertido a USD con la tasa BCV del día.';
comment on column public.contabilidad_compras.tasa_bcv_ves_por_usd is
  'Tasa BCV (Bs/USD) usada al registrar la compra.';
comment on column public.contabilidad_compras.total_amount_usd is
  'Monto total en USD (total_amount en Bs ÷ tasa BCV).';
