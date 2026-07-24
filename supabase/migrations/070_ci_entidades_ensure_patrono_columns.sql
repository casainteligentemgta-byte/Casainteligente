-- Idempotente: asegura columnas de patrono en ci_entidades si 064 no llegó a ejecutarse en este entorno.
-- Corrige PostgREST: "Could not find the 'direccion_fiscal' column of 'ci_entidades' in the schema cache".

alter table public.ci_entidades
  add column if not exists nombre_comercial text,
  add column if not exists direccion_fiscal text,
  add column if not exists rep_legal_nombre text,
  add column if not exists rep_legal_cedula text,
  add column if not exists rep_legal_cargo text,
  add column if not exists registro_mercantil jsonb not null default '{}'::jsonb,
  add column if not exists permisologia jsonb not null default '{}'::jsonb,
  add column if not exists logo_url text,
  add column if not exists sello_url text;

comment on column public.ci_entidades.direccion_fiscal is
  'Domicilio fiscal o sede principal.';

notify pgrst, 'reload schema';
