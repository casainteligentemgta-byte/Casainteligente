-- Repair: asegura columnas de unificación (091) + datos de contrato (301) en customers.
-- Idempotente. Usar también en SQL Editor de producción si PostgREST reporta
-- "column customers.customer_type does not exist".

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'customer_category' and n.nspname = 'public'
  ) then
    create type public.customer_category as enum ('natural', 'juridico');
  end if;
end $$;

alter table public.customers
  add column if not exists customer_type public.customer_category default 'natural',
  add column if not exists razon_social text,
  add column if not exists representante_legal text,
  add column if not exists cedula text,
  add column if not exists apellido text,
  add column if not exists telefono text,
  add column if not exists rif text,
  add column if not exists email text,
  add column if not exists genero text,
  add column if not exists estado_civil text,
  add column if not exists profesion text;

-- Backfill telefono desde movil legacy.
update public.customers
set telefono = coalesce(nullif(telefono, ''), nullif(movil, ''))
where telefono is null or telefono = '';

-- Normaliza customer_type desde tipo legacy.
update public.customers
set customer_type = case
  when coalesce(nullif(tipo, ''), '') ilike '%empresa%' then 'juridico'::public.customer_category
  when coalesce(nullif(tipo, ''), '') ilike '%jurid%' then 'juridico'::public.customer_category
  when upper(coalesce(nullif(tipo, ''), '')) = 'J' then 'juridico'::public.customer_category
  else coalesce(customer_type, 'natural'::public.customer_category)
end
where customer_type is null
   or (
     customer_type = 'natural'::public.customer_category
     and (
       coalesce(nullif(tipo, ''), '') ilike '%empresa%'
       or coalesce(nullif(tipo, ''), '') ilike '%jurid%'
       or upper(coalesce(nullif(tipo, ''), '')) = 'J'
     )
   );

alter table public.customers
  alter column customer_type set default 'natural'::public.customer_category;

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

create unique index if not exists uq_customers_rif
  on public.customers (lower(rif))
  where rif is not null and btrim(rif) <> '';

create unique index if not exists uq_customers_cedula
  on public.customers (lower(cedula))
  where cedula is not null and btrim(cedula) <> '';

comment on column public.customers.customer_type is
  'natural | juridico — unificación CRM clientes.';
comment on column public.customers.genero is
  'Tratamiento Sr./Sra. para contratos: M = Sr., F = Sra.';
comment on column public.customers.estado_civil is
  'Estado civil para comparecencia en contratos.';
comment on column public.customers.profesion is
  'Profesión u oficio para comparecencia en contratos.';

notify pgrst, 'reload schema';
