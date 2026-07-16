-- Cédula en customers (persona natural / CRM). Idempotente.

alter table public.customers
  add column if not exists cedula text;

comment on column public.customers.cedula is
  'Documento de identidad del cliente natural; índice único opcional vía migración 091.';

notify pgrst, 'reload schema';
