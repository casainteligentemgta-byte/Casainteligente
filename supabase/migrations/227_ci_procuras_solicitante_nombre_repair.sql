-- Reparación idempotente: columna solicitante_nombre + recarga caché PostgREST.

alter table public.ci_procuras
  add column if not exists solicitante_nombre text;

comment on column public.ci_procuras.solicitante_nombre is
  'Nombre de quien realiza la solicitud de procura (snapshot al crear).';

notify pgrst, 'reload schema';
