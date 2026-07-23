-- Agrega campos necesarios para documentos legales a la tabla customers (clientes)
-- Estos campos pueden ser rellenados desde /clientes/nuevo o en edición,
-- y se usarán al redactar contratos, poderes u otros documentos.

alter table public.customers
  add column if not exists nacionalidad text,
  add column if not exists estado_civil text,
  add column if not exists profesion text;

comment on column public.customers.nacionalidad is
  'Nacionalidad del cliente (ej. Venezolano, Extranjero)';
comment on column public.customers.estado_civil is
  'Estado civil del cliente (ej. Soltero, Casado, Divorciado, Viudo)';
comment on column public.customers.profesion is
  'Profesión u oficio del cliente';

notify pgrst, 'reload schema';
