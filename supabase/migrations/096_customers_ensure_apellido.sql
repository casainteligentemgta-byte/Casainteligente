-- Asegura columna apellido en customers (formulario /clientes/nuevo) y refresca caché de PostgREST.
-- Idempotente: seguro si 091_unificar_clientes.sql ya se aplicó.

alter table public.customers
  add column if not exists apellido text;

comment on column public.customers.apellido is
  'Apellido(s) del cliente natural; jurídicos suelen dejarlo null.';

notify pgrst, 'reload schema';
