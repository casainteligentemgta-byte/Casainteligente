-- Arreglo de pago pactado con el trabajador, guardado con su contrato de trabajo.
-- La nómina semanal de obra lo lee para pagar lo pactado (por defecto: 90 ayudante / 115 clasificado).
-- Aplicada en producción el 2026-10-07.

alter table public.ci_contratos_express
  add column if not exists arreglo_semanal_usd numeric(10,2),
  add column if not exists arreglo_mensual_usd numeric(10,2);

comment on column public.ci_contratos_express.arreglo_semanal_usd is
  'Arreglo de pago semanal pactado con el trabajador (USD como moneda de cuenta).';
comment on column public.ci_contratos_express.arreglo_mensual_usd is
  'Arreglo de pago mensual (cada cuatro semanas trabajadas), en USD como moneda de cuenta.';
