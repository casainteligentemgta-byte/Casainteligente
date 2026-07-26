-- Pegar en SQL Editor de Supabase (producción) si aparece:
--   column customers.customer_type does not exist
-- Idempotente. Recarga PostgREST al final.

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

update public.customers
set telefono = coalesce(nullif(telefono, ''), nullif(movil, ''))
where telefono is null or telefono = '';

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

-- Placeholders tipo "V-" / "J-" rompen el índice único; se anulan.
update public.customers
set rif = null
where rif is not null
  and (
    btrim(rif) = ''
    or length(regexp_replace(btrim(rif), '[^0-9]', '', 'g')) < 4
    or lower(btrim(rif)) in ('v-', 'j-', 'e-', 'g-', 'p-', 'c-')
  );

update public.customers
set cedula = null
where cedula is not null
  and (
    btrim(cedula) = ''
    or length(regexp_replace(btrim(cedula), '[^0-9]', '', 'g')) < 4
  );

-- Si hay RIF/cédula reales duplicados, deja el más antiguo y anula el resto.
with dups as (
  select id,
    row_number() over (
      partition by lower(btrim(rif))
      order by created_at nulls last, id
    ) as rn
  from public.customers
  where rif is not null
    and btrim(rif) <> ''
    and length(regexp_replace(btrim(rif), '[^0-9]', '', 'g')) >= 4
)
update public.customers c
set rif = null
from dups d
where c.id = d.id and d.rn > 1;

with dups as (
  select id,
    row_number() over (
      partition by lower(btrim(cedula))
      order by created_at nulls last, id
    ) as rn
  from public.customers
  where cedula is not null
    and btrim(cedula) <> ''
    and length(regexp_replace(btrim(cedula), '[^0-9]', '', 'g')) >= 4
)
update public.customers c
set cedula = null
from dups d
where c.id = d.id and d.rn > 1;

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

drop index if exists public.uq_customers_rif;
drop index if exists public.uq_customers_cedula;

create unique index uq_customers_rif
  on public.customers (lower(rif))
  where rif is not null
    and btrim(rif) <> ''
    and length(regexp_replace(btrim(rif), '[^0-9]', '', 'g')) >= 4;

create unique index uq_customers_cedula
  on public.customers (lower(cedula))
  where cedula is not null
    and btrim(cedula) <> ''
    and length(regexp_replace(btrim(cedula), '[^0-9]', '', 'g')) >= 4;

notify pgrst, 'reload schema';
