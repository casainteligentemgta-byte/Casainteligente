-- Consolidación módulo clientes:
-- customers como única fuente de verdad para Naturales y Jurídicos.

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
  add column if not exists apellido text;

-- Unificación de teléfonos (movil legacy -> telefono canonical).
alter table public.customers
  add column if not exists telefono text;

update public.customers
set telefono = coalesce(nullif(telefono, ''), nullif(movil, ''))
where telefono is null or telefono = '';

alter table public.customers
  add column if not exists rif text;

alter table public.customers
  add column if not exists email text;

-- Normaliza tipo para registros previos.
update public.customers
set customer_type = case
  when coalesce(nullif(tipo, ''), '') ilike '%empresa%' then 'juridico'::public.customer_category
  when coalesce(nullif(tipo, ''), '') ilike '%jurid%' then 'juridico'::public.customer_category
  else 'natural'::public.customer_category
end
where customer_type is null;

alter table public.customers
  alter column customer_type set default 'natural'::public.customer_category;

-- Índices únicos (permiten nulos y vacíos fuera del índice).
create unique index if not exists uq_customers_rif
  on public.customers (lower(rif))
  where rif is not null and btrim(rif) <> '';

create unique index if not exists uq_customers_cedula
  on public.customers (lower(cedula))
  where cedula is not null and btrim(cedula) <> '';

-- Inserta Naturales desde legacy personas.
insert into public.customers (
  nombre,
  apellido,
  cedula,
  email,
  telefono,
  movil,
  direccion,
  customer_type,
  tipo,
  status,
  created_at,
  updated_at
)
select
  coalesce(nullif(btrim(p.nombre), ''), 'Sin nombre') as nombre,
  nullif(btrim(p.apellidos), '') as apellido,
  nullif(btrim(
    p.documento
  ), '') as cedula,
  nullif(btrim(p.email), '') as email,
  nullif(btrim(p.telefono), '') as telefono,
  nullif(btrim(p.telefono), '') as movil,
  nullif(btrim(p.direccion), '') as direccion,
  'natural'::public.customer_category as customer_type,
  'Natural' as tipo,
  'activo' as status,
  coalesce(p.creado_en, now()) as created_at,
  coalesce(p.actualizado_en, now()) as updated_at
from public.personas p
where not exists (
  select 1
  from public.customers c
  where lower(coalesce(c.cedula, '')) = lower(coalesce(nullif(btrim(p.documento), ''), '___none___'))
    and nullif(btrim(p.documento), '') is not null
)
and not exists (
  select 1
  from public.customers c
  where lower(btrim(c.nombre)) = lower(btrim(coalesce(p.nombre, '')))
    and lower(coalesce(c.email, '')) = lower(coalesce(p.email, ''))
);

-- Inserta Jurídicos desde legacy empresas.
insert into public.customers (
  nombre,
  razon_social,
  rif,
  representante_legal,
  email,
  telefono,
  movil,
  direccion,
  customer_type,
  tipo,
  status,
  created_at,
  updated_at
)
select
  coalesce(nullif(btrim(e.nombre), ''), 'Empresa sin nombre') as nombre,
  nullif(btrim(e.nombre), '') as razon_social,
  nullif(btrim(e.rif), '') as rif,
  null as representante_legal,
  nullif(btrim(e.email), '') as email,
  nullif(btrim(e.telefono), '') as telefono,
  nullif(btrim(e.telefono), '') as movil,
  nullif(btrim(e.direccion), '') as direccion,
  'juridico'::public.customer_category as customer_type,
  'Juridico' as tipo,
  'activo' as status,
  coalesce(e.creado_en, now()) as created_at,
  coalesce(e.actualizado_en, now()) as updated_at
from public.empresas e
where not exists (
  select 1
  from public.customers c
  where lower(coalesce(c.rif, '')) = lower(coalesce(nullif(btrim(e.rif), ''), '___none___'))
    and nullif(btrim(e.rif), '') is not null
)
and not exists (
  select 1
  from public.customers c
  where lower(btrim(c.nombre)) = lower(btrim(coalesce(e.nombre, '')))
    and lower(coalesce(c.email, '')) = lower(coalesce(e.email, ''))
);

-- Vistas de compatibilidad para consultas legacy.
create or replace view public.view_clientes_naturales as
select *
from public.customers
where customer_type = 'natural'::public.customer_category;

create or replace view public.view_clientes_juridicos as
select *
from public.customers
where customer_type = 'juridico'::public.customer_category;

-- Deprecación de tablas legacy.
do $$
begin
  if to_regclass('public.personas') is not null and to_regclass('public.personas_deprecated') is null then
    execute 'alter table public.personas rename to personas_deprecated';
  end if;
end $$;

do $$
begin
  if to_regclass('public.empresas') is not null and to_regclass('public.empresas_deprecated') is null then
    execute 'alter table public.empresas rename to empresas_deprecated';
  end if;
end $$;

notify pgrst, 'reload schema';
