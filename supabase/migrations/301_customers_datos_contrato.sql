-- Datos de comparecencia / firma de contratos en clientes CRM.
-- Idempotente. Complementa cedula, rif y direccion (domicilio) ya existentes.

alter table public.customers
  add column if not exists genero text,
  add column if not exists estado_civil text,
  add column if not exists profesion text;

comment on column public.customers.genero is
  'Tratamiento Sr./Sra. para contratos: M = Sr., F = Sra. (persona natural o representante legal).';

comment on column public.customers.estado_civil is
  'Estado civil para comparecencia en contratos (persona natural o representante legal).';

comment on column public.customers.profesion is
  'Profesión u oficio para comparecencia en contratos (persona natural o representante legal).';

comment on column public.customers.direccion is
  'Domicilio del cliente (o del representante) para rellenar contratos.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_genero_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_genero_check
      check (genero is null or genero in ('M', 'F'));
  end if;
end $$;

notify pgrst, 'reload schema';
